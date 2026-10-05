import { router } from "@inertiajs/react";
import { useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from "react";
import { button, ghost, input } from "@/Components/admin/ui";
import { AUDIO_ACCEPT, COVER_ACCEPT, readDuration } from "@/Components/radio/admin-ui";
import { postAudio } from "@/Components/radio/audio-upload";
import { SearchIcon } from "@/Components/radio/icons";
import { duration, type RadioGenre, type RadioTrack } from "@/lib/radio";
import { artistHints, parseFileName, recognizeSong, type SongDetails } from "@/lib/radio/audio-tags";
import {
  DuplicateBadge,
  DuplicatePanel,
  LibraryTwin,
  choiceOf,
  concernKey,
  concerns,
  decide,
  duplicateShade,
  isPending,
  listenKey,
  needsDecision,
  replaceTarget,
  reviewDuplicates,
  type DuplicateChoice,
  type DuplicateDecision,
  type DuplicateMatch,
  type DuplicateReview,
} from "./duplicates";
import { CoAuthorsField, CoverPicker, GenrePicker, LookupBadge, MusicNote, cleanYear, identifySong, identityJson, mergeNames, plain, type LookupState } from "./song-fields";

type Kind = RadioTrack["kind"];

type Upload = {
  key: string;
  file: File;
  kind: Kind;
  duck: boolean;
  duration: number | null;
  progress: number;
  status: "reading" | "ready" | "uploading" | "done" | "error";
  error?: string;
  /** The last upload failed: it is not tried again on its own until the admin changes something or retries. */
  blocked: boolean;
  title: string;
  artist: string;
  featured: string[];
  album: string;
  year: string;
  genres: RadioGenre[];
  /** Genre written in the file's tags, used when the internet gives none. */
  tagGenre: string;
  cover: Blob | null;
  coverUrl: string | null;
  /** Cover found on the internet; the server downloads it when the song is uploaded without its own cover. */
  remoteCover: string | null;
  source: SongDetails["source"] | null;
  lookup: LookupState | null;
  identity: string | null;
  /** Songs of the library or of this upload it repeats. */
  duplicates: DuplicateReview;
  /** What the song and the ones before it were like when `duplicates` was given (see `reviewContexts`). */
  reviewedAs: string | null;
  /** What the admin chose for a song that may repeat another; it is not saved until there is a choice. */
  decision: DuplicateDecision | null;
  /** Title of the library song whose audio this upload replaced. */
  replaced: string | null;
  /** Also publish it on /radio as an episode, with this description and cover. */
  episode: boolean;
  description: string;
  episodeCover: File | null;
};

/** Where an audio is on its way to the library. */
type Phase = "reading" | "searching" | "checking" | "incomplete" | "verdict" | "blocked" | "skip" | "queued" | "uploading" | "done" | "unreadable";

/** Whether the review of repeated songs covers the song as the list is now, or was given up after failing several times in a row. */
type ReviewState = { fresh: boolean; gaveUp: boolean };

type Props = {
  kinds: Record<Kind, string>;
  genres: RadioGenre[];
  families: Record<string, string>;
  maxGenres: number;
  maxFeatured: number;
  maxMb: number;
  maxDescription: number;
  canEpisodes: boolean;
  /** Authors already in the library, to tell the author from the song in file names. */
  knownArtists: string[];
};

const LIBRARY = "/admin/radio/biblioteca";
const AUDIO_FILE = /\.(mp3|m4a|aac|ogg|oga|opus|wav|webm|flac)$/i;
const MAX_COVER_BYTES = 8 * 1024 * 1024;
const small = `${input} !mt-0 !py-2`;
/** Pause between a change and its review, so the changes of that moment are asked about together. */
const REVIEW_DELAY_MS = 900;
const REVIEW_RETRY_MS = 5000;
/** Failed reviews in a row before uploading without it (the server still refuses an exact repeat). */
const REVIEW_ATTEMPTS = 3;
/** Songs judged per review, the first of the list first since they go up first: each one is compared with the whole library. */
const REVIEW_CHUNK = 40;
const LOOKUP_ATTEMPTS = 3;
const LOOKUP_RETRY_MS = 2500;
/** Uploads between refreshes of the library list below, during a long upload. */
const RELOAD_EVERY = 15;
/** Phases that move on by themselves. */
const WORKING = new Set<Phase>(["reading", "searching", "checking", "queued", "uploading"]);
/** Phases that wait for the admin. */
const WAITING = new Set<Phase>(["incomplete", "verdict", "blocked"]);

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Spoken audio lowers the music by default when it plays on top of it. */
const duckFor = (kind: Kind) => kind === "anuncio" || kind === "programa";

/** Songs of the duplicate review, in upload order; the ones already uploaded stay, as the songs after them were compared with them. */
const inReview = (item: Upload) => item.kind === "musica" && (item.status === "ready" || item.status === "uploading" || item.status === "done") && item.title.trim().length >= 2;

/** FNV-1a fingerprint of a text. */
function fingerprint(text: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

/**
 * What the review of each song rests on: its data and that of the songs before it. A song is compared again only when
 * this changes, so in a long upload a change asks again for the songs after it, not for the whole list.
 */
function reviewContexts(list: Upload[]) {
  const contexts = new Map<string, string>();
  let chain = "";
  list.filter(inReview).forEach((item) => {
    chain = fingerprint(`${chain}|${JSON.stringify([item.key, item.title.trim(), item.artist.trim(), item.featured, item.album.trim(), item.year, item.duration, item.identity])}`);
    contexts.set(item.key, chain);
  });
  return contexts;
}

/** A song whose review is missing or out of date, and whose data is settled (not being searched). */
const needsReview = (item: Upload, contexts: Map<string, string>) =>
  item.status === "ready" && item.lookup?.status !== "searching" && contexts.has(item.key) && item.reviewedAs !== contexts.get(item.key);

/** Songs of the upload this song was found to match, by their keys. */
const batchMatches = (item: Upload) => (Array.isArray(item.duplicates) ? item.duplicates.flatMap((match) => (match.batch ? [match.batch] : [])) : []);

function sizeLabel(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** What keeps an audio from being uploaded, or null when it is complete. */
function missing(item: Upload) {
  if (!item.title.trim()) return item.kind === "musica" ? "Falta el nombre de la canción." : "Falta el nombre del audio.";
  if (item.kind === "musica" && !item.artist.trim()) return "Falta el autor de la canción.";
  if (item.year && item.year.length !== 4) return "El año va con 4 cifras (por ejemplo 2024).";
  return null;
}

/** The field to fill first in an incomplete audio. */
function missingField(item: Upload) {
  if (!item.title.trim()) return "title";
  if (item.kind === "musica" && !item.artist.trim()) return "artist";
  return "year";
}

const isSongReady = (item: Upload) => item.kind === "musica" && item.status === "ready";

/** The admin's choice for a song that may repeat another, as it is reviewed now. */
const choiceFor = (item: Upload): DuplicateChoice | null => (item.kind === "musica" ? choiceOf(item.duplicates, item.decision) : null);

/** A song not uploaded yet that may repeat another, whether or not the admin decided already. */
const isRepeat = (item: Upload) => item.kind === "musica" && (item.status === "ready" || item.status === "uploading") && needsDecision(item.duplicates);

/**
 * Where an audio is: it goes up on its own once it was read, searched on the internet, compared with the library
 * and is complete; it waits for the admin only when data is missing, it may repeat another song or its upload failed.
 */
function phaseOf(item: Upload, review: ReviewState): Phase {
  if (item.status === "done") return "done";
  if (item.status === "uploading") return "uploading";
  if (item.status === "reading") return "reading";
  if (item.status === "error") return "unreadable";
  if (item.lookup?.status === "searching") return "searching";
  if (missing(item)) return "incomplete";
  if (item.blocked) return "blocked";
  if (item.kind !== "musica") return "queued";
  if (item.title.trim().length >= 2 && !review.gaveUp && !review.fresh) return "checking";
  if (isPending(item.duplicates, item.decision)) return "verdict";
  return choiceFor(item) === "skip" ? "skip" : "queued";
}

/**
 * Keeps a choice when the song it was made about was uploaded in the meantime: «the other song of this upload»
 * becomes that same song in the library, so the admin is not asked again.
 */
function carry(decision: DuplicateDecision | null, review: DuplicateReview, uploaded: Map<string, string>): DuplicateDecision | null {
  if (!decision || !needsDecision(review)) return decision;
  const now = concernKey(review);
  if (decision.about === now) return decision;
  const sorted = (parts: string[]) => [...parts].sort().join("|");
  const before = decision.about.split("|").map((part) => (part.startsWith("b:") && uploaded.has(part.slice(2)) ? `t:${uploaded.get(part.slice(2))}` : part));
  return sorted(before) === sorted(now.split("|")) ? { ...decision, about: now } : decision;
}

/** Songs that may repeat each other, together and in upload order (the first one, then its repeats), so they can be compared one after the other. */
function groupRepeats(active: Upload[]): Upload[][] {
  const position = new Map(active.map((item, index) => [item.key, index]));
  const parent = new Map<string, string>();
  const root = (key: string) => {
    let at = key;
    while (parent.get(at) !== at) at = parent.get(at) as string;
    return at;
  };
  const link = (first: string, second: string) => {
    [first, second].forEach((key) => parent.has(key) || parent.set(key, key));
    const [head, tail] = [root(first), root(second)].sort((a, b) => (position.get(a) ?? 0) - (position.get(b) ?? 0));
    if (head !== tail) parent.set(tail, head);
  };
  active.filter(isRepeat).forEach((item) => {
    link(item.key, item.key);
    concerns(item.duplicates).forEach((match) => {
      if (match.batch && position.has(match.batch)) link(item.key, match.batch);
    });
  });
  const groups = new Map<string, Upload[]>();
  active.forEach((item) => {
    if (!parent.has(item.key)) return;
    const head = root(item.key);
    groups.set(head, [...(groups.get(head) ?? []), item]);
  });
  return [...groups.values()];
}

function coverName(blob: Blob) {
  return `caratula.${blob.type === "image/png" ? "png" : blob.type === "image/webp" ? "webp" : "jpg"}`;
}

const nameKey = (name: string) => plain(name).replace(/[^a-z0-9]/g, "");
const sameList = (first: string[], second: string[]) => first.join("\n") === second.join("\n");
const plural = (count: number, one: string, many: string) => (count === 1 ? `1 ${one}` : `${count} ${many}`);

/**
 * Completes a song with what the internet said, without stepping on what the admin typed while it searched:
 * a field is only filled when it is still as it was when the search started, and (unless `force`) when it was empty.
 */
function fill(current: Upload, base: Upload, state: LookupState, force: boolean, limits: { featured: number; genres: number }): Upload {
  const next: Upload = { ...current, lookup: state };
  if (state.status !== "found") return next;
  const result = state.result;
  const untouched = (field: "title" | "artist" | "album" | "year") => current[field] === base[field];
  if (result.found) {
    if (result.title && untouched("title") && (force || current.source !== "tags" || !current.title.trim())) next.title = result.title;
    if (result.artist && untouched("artist")) next.artist = result.artist;
    if (sameList(current.featured, base.featured)) {
      const main = nameKey(next.artist);
      next.featured = mergeNames(
        base.featured.filter((name) => nameKey(name) !== main),
        result.featured.filter((name) => nameKey(name) !== main),
        limits.featured,
      );
    }
    if (result.album && untouched("album") && (force || !current.album.trim())) next.album = result.album;
    if (result.year && untouched("year") && (force || !current.year)) next.year = String(result.year);
    if (result.cover_url && !current.cover) {
      next.remoteCover = result.cover_url;
      next.coverUrl = result.cover_url;
    }
    next.identity = identityJson(result);
  }
  const sameGenres = current.genres.map((genre) => genre.id).join() === base.genres.map((genre) => genre.id).join();
  if (result.genres.length && sameGenres && (force || current.genres.length === 0)) next.genres = result.genres.slice(0, limits.genres);
  return next;
}

/**
 * Upload area of the library: drop or pick files, each song is recognized from its tags or its name and searched on the internet.
 * «Guardar» starts an upload that runs on its own: every audio goes up, one at a time, as soon as its search and its
 * duplicate review end; songs that may repeat another wait together for the admin's verdict, and incomplete ones for their data.
 */
export function UploadPanel({ kinds, genres, families, maxGenres, maxFeatured, maxMb, maxDescription, canEpisodes, knownArtists }: Props) {
  const [queue, setQueue] = useState<Upload[]>([]);
  const [uploadKind, setUploadKind] = useState<Kind>("musica");
  const [auto, setAuto] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [notice, setNotice] = useState<{ tone: "ok" | "warn"; text: string } | null>(null);
  const [previewing, setPreviewing] = useState<string | null>(null);
  const [bulk, setBulk] = useState<{ artist: string; album: string; genres: RadioGenre[]; year: string }>({ artist: "", album: "", genres: [], year: "" });
  const [reviewFailures, setReviewFailures] = useState(0);
  const [flash, setFlash] = useState<string | null>(null);
  const [visited, setVisited] = useState<Record<string, number>>({});
  const picker = useRef<HTMLInputElement>(null);
  const depth = useRef(0);
  const player = useRef<HTMLAudioElement | null>(null);
  const urls = useRef(new Set<string>());
  const current = useRef(queue);
  const lookups = useRef<Promise<void>>(Promise.resolve());
  const asking = useRef(false);
  const reviewTimer = useRef(0);
  const retry = useRef(0);
  const busy = useRef(false);
  const running = useRef(false);
  const flashTimer = useRef(0);
  /** Library id each song of this upload got, by its key. */
  const uploadedAs = useRef(new Map<string, string>());
  /** Keys of the songs uploaded, in the order they went up. */
  const uploads = useRef<string[]>([]);
  const tally = useRef({ uploaded: 0, replaced: 0, unsynced: 0 });
  const [reviewRound, setReviewRound] = useState(0);
  current.current = queue;
  running.current = auto;

  const kindList = Object.keys(kinds) as Kind[];
  const contexts = useMemo(() => reviewContexts(queue), [queue]);
  const gaveUp = reviewFailures >= REVIEW_ATTEMPTS;
  const phases = new Map(queue.map((item) => [item.key, phaseOf(item, { fresh: item.reviewedAs === contexts.get(item.key), gaveUp })]));
  const pendingReview = queue
    .filter((item) => needsReview(item, contexts))
    .slice(0, REVIEW_CHUNK)
    .map((item) => contexts.get(item.key))
    .join();
  const phase = (item: Upload) => phases.get(item.key) as Phase;

  useEffect(
    () => () => {
      player.current?.pause();
      urls.current.forEach((url) => URL.revokeObjectURL(url));
      [retry, reviewTimer, flashTimer].forEach((timer) => {
        window.clearTimeout(timer.current);
        timer.current = 0;
      });
    },
    [],
  );

  /**
   * Each song is compared with the library and with the songs before it once its data is settled, and again when it or
   * a song before it changes; one review at a time, a failed one is asked again. A result is kept only if the song is
   * still as it was asked and no song it could repeat reached the library meanwhile.
   */
  useEffect(() => {
    if (!pendingReview || asking.current || reviewTimer.current || retry.current) return;
    reviewTimer.current = window.setTimeout(async () => {
      reviewTimer.current = 0;
      const list = current.current;
      const asked = reviewContexts(list);
      const judge = list.filter((item) => needsReview(item, asked)).slice(0, REVIEW_CHUNK);
      if (!judge.length) return;
      const songs = list.slice(0, list.indexOf(judge[judge.length - 1]) + 1).filter((item) => inReview(item) && item.status !== "done");
      const from = uploads.current.length;
      asking.current = true;
      const results = await reviewDuplicates(songs, judge.map((item) => item.key));
      asking.current = false;
      if (!results) {
        setReviewFailures((count) => count + 1);
        retry.current = window.setTimeout(() => {
          retry.current = 0;
          setReviewRound((round) => round + 1);
        }, REVIEW_RETRY_MS);
        return;
      }
      const since = new Set(uploads.current.slice(from));
      const judged = new Set(judge.map((item) => item.key));
      setReviewFailures(0);
      setQueue((now) => {
        const contextsNow = reviewContexts(now);
        const lastUploaded = now.reduce((last, item, index) => (since.has(item.key) ? index : last), -1);
        return now.map((item, index) => {
          const context = asked.get(item.key);
          if (!judged.has(item.key) || item.status !== "ready" || !context || contextsNow.get(item.key) !== context) return item;
          const found = results[item.key] ?? [];
          if (index < lastUploaded || found.some((match) => match.batch && since.has(match.batch))) return item;
          return { ...item, duplicates: found, reviewedAs: context, decision: carry(item.decision, found, uploadedAs.current) };
        });
      });
      setReviewRound((round) => round + 1);
    }, REVIEW_DELAY_MS);
  }, [pendingReview, reviewRound]);

  /**
   * The upload in course: the next audio that finished its searches goes up, one at a time, until only what needs the
   * admin is left. It does not go past a song still being compared, which could turn out to repeat it.
   */
  useEffect(() => {
    if (!auto || busy.current) return;
    const next = queue.find((item) => phase(item) === "queued" || phase(item) === "checking");
    if (next && phase(next) === "queued") {
      void upload(next);
      return;
    }
    const now = queue.map(phase);
    if (now.some((value) => WORKING.has(value))) return;
    syncLibrary();
    if (!now.some((value) => WAITING.has(value))) finish();
  });

  const inFlight = auto && queue.some((item) => WORKING.has(phase(item)));
  useEffect(() => {
    if (!inFlight) return;
    const unload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", unload);
    const off = router.on("before", (event) => {
      if (event.detail.visit.only.length) return;
      if (!window.confirm("La subida sigue en curso. Si sales de esta página se detiene (lo que ya se subió queda guardado). ¿Salir igual?")) event.preventDefault();
    });
    return () => {
      window.removeEventListener("beforeunload", unload);
      off();
    };
  }, [inFlight]);

  function objectUrl(blob: Blob) {
    const url = URL.createObjectURL(blob);
    urls.current.add(url);
    return url;
  }

  function dropUrl(url: string | null) {
    if (!url) return;
    URL.revokeObjectURL(url);
    urls.current.delete(url);
  }

  function patch(key: string, values: Partial<Upload>) {
    const update = (list: Upload[]) => list.map((item) => (item.key === key ? { ...item, ...values } : item));
    current.current = update(current.current);
    setQueue(update);
  }

  /** A change made by the admin: a failed upload may go up again with it. */
  function edit(item: Upload, values: Partial<Upload>) {
    patch(item.key, item.status === "ready" ? { ...values, blocked: false, error: undefined } : values);
  }

  /** One song at a time, so the music services are asked politely; each one reads the song as it is when its turn comes, and a failed search is tried again. */
  function lookUp(key: string, force = false) {
    patch(key, { lookup: { status: "searching" } });
    lookups.current = lookups.current.then(async () => {
      const base = current.current.find((item) => item.key === key);
      if (!base || base.kind !== "musica" || base.status !== "ready" || base.title.trim().length < 2) {
        patch(key, { lookup: null });
        return;
      }
      const song = { title: base.title, artist: base.artist, featured: base.featured, duration: base.duration, genre: base.tagGenre };
      let state = await identifySong(song);
      for (let attempt = 1; state.status === "error" && attempt < LOOKUP_ATTEMPTS; attempt++) {
        await wait(LOOKUP_RETRY_MS * attempt);
        if (!current.current.some((item) => item.key === key)) return;
        state = await identifySong(song);
      }
      setQueue((list) => list.map((item) => (item.key === key ? fill(item, base, state, force, { featured: maxFeatured, genres: maxGenres }) : item)));
    });
  }

  function addFiles(list: FileList | File[] | null) {
    if (!list?.length) return;
    const files = Array.from(list);
    const audio = files.filter((file) => AUDIO_FILE.test(file.name) || file.type.startsWith("audio/"));
    const known = new Set(queue.map((item) => `${item.file.name}:${item.file.size}`));
    const fresh = audio.filter((file) => !known.has(`${file.name}:${file.size}`));
    const skipped = files.length - audio.length;
    const repeated = audio.length - fresh.length;
    setNotice(
      skipped || repeated
        ? {
            tone: "warn",
            text: [skipped ? `${skipped} ${skipped === 1 ? "archivo no es audio y se dejó" : "archivos no son audio y se dejaron"} fuera.` : "", repeated ? `${repeated} ya ${repeated === 1 ? "estaba" : "estaban"} en la lista.` : ""].filter(Boolean).join(" "),
          }
        : null,
    );

    const hints = artistHints(
      [...queue.map((item) => item.file.name), ...fresh.map((file) => file.name)],
      [...knownArtists, ...queue.flatMap((item) => (item.kind === "musica" && item.status !== "reading" ? [item.artist, ...item.featured] : []))],
    );
    const items: Upload[] = fresh.map((file, index) => {
      const guess = parseFileName(file.name, hints);
      const tooBig = file.size > maxMb * 1024 * 1024;
      return {
        key: `${Date.now()}-${index}-${file.name}`,
        file,
        kind: uploadKind,
        duck: duckFor(uploadKind),
        duration: null,
        progress: 0,
        status: tooBig ? "error" : "reading",
        error: tooBig ? `Pesa más de ${maxMb} MB. Expórtalo en MP3 (128–192 kbps).` : undefined,
        blocked: false,
        title: guess.title,
        artist: uploadKind === "musica" ? guess.artist : "",
        featured: uploadKind === "musica" ? guess.featured : [],
        album: "",
        year: "",
        genres: [],
        tagGenre: "",
        cover: null,
        coverUrl: null,
        remoteCover: null,
        source: null,
        lookup: null,
        identity: null,
        duplicates: null,
        reviewedAs: null,
        decision: null,
        replaced: null,
        episode: false,
        description: "",
        episodeCover: null,
      };
    });
    setQueue((current) => [...current, ...items]);

    items
      .filter((item) => item.status === "reading")
      .forEach(async (item) => {
        const [seconds, details] = await Promise.all([readDuration(item.file), recognizeSong(item.file, hints)]);
        if (!seconds) {
          patch(item.key, { status: "error", error: "No pudimos leer este audio. Prueba con MP3 o M4A." });
          return;
        }
        patch(item.key, {
          duration: seconds,
          status: "ready",
          title: details.title || item.title,
          artist: details.artist,
          featured: details.featured.slice(0, maxFeatured),
          album: details.album,
          year: details.year,
          tagGenre: details.genre,
          cover: details.cover,
          coverUrl: details.cover ? objectUrl(details.cover) : null,
          source: details.source,
        });
        if (item.kind === "musica" && (details.title || item.title).trim().length >= 2) lookUp(item.key);
      });
  }

  function remove(item: Upload) {
    if (previewing === item.key) stopPreview();
    dropUrl(item.coverUrl);
    setQueue((list) => list.filter((entry) => entry.key !== item.key));
  }

  function clear() {
    stopPreview();
    queue.forEach((item) => dropUrl(item.coverUrl));
    setQueue([]);
    setNotice(null);
    syncLibrary();
  }

  function setCover(item: Upload, file: File | null) {
    if (file && (file.size > MAX_COVER_BYTES || !COVER_ACCEPT.split(",").includes(file.type))) {
      setNotice({ tone: "warn", text: "La carátula debe ser una imagen JPG, PNG o WEBP de hasta 8 MB." });
      return;
    }
    dropUrl(item.coverUrl);
    edit(item, { cover: file, coverUrl: file ? objectUrl(file) : null, remoteCover: null });
  }

  function stopPreview() {
    player.current?.pause();
    if (player.current?.src) dropUrl(player.current.src);
    setPreviewing(null);
  }

  function play(id: string, src: string) {
    stopPreview();
    player.current ??= new Audio();
    player.current.src = src;
    player.current.onended = stopPreview;
    player.current.play().catch(() => setPreviewing(null));
    setPreviewing(id);
  }

  function togglePreview(item: Upload) {
    if (previewing === item.key) stopPreview();
    else play(item.key, objectUrl(item.file));
  }

  /** Plays the song a card may repeat (the library one or the other one of this upload), to compare them by ear. */
  function listen(match: DuplicateMatch) {
    const key = listenKey(match);
    if (previewing === key) {
      stopPreview();
      return;
    }
    if (match.track?.src) {
      play(key, match.track.src);
      return;
    }
    const other = current.current.find((item) => item.key === match.batch);
    if (other) togglePreview(other);
  }

  /** The same choice for every song that may repeat another, for long uploads. */
  function decideAll(choice: DuplicateChoice) {
    setQueue((list) => list.map((item) => (isSongReady(item) && needsDecision(item.duplicates) ? { ...item, decision: decide(item.duplicates, choice), blocked: false, error: undefined } : item)));
  }

  function applyToAll() {
    const values: Partial<Upload> = {};
    if (bulk.artist.trim()) values.artist = bulk.artist.trim();
    if (bulk.album.trim()) values.album = bulk.album.trim();
    if (bulk.genres.length) values.genres = bulk.genres;
    if (bulk.year) values.year = bulk.year;
    setQueue((list) => list.map((item) => (item.kind === "musica" && (item.status === "ready" || item.status === "error") ? { ...item, ...values, blocked: false } : item)));
  }

  /** Refreshes the library list below with what was uploaded since the last time. */
  function syncLibrary() {
    if (!tally.current.unsynced) return;
    tally.current.unsynced = 0;
    router.reload({ only: ["tracks"] });
  }

  function start() {
    stopPreview();
    setNotice(null);
    setQueue((list) => list.map((item) => (item.blocked ? { ...item, blocked: false } : item)));
    setAuto(true);
  }

  function pause() {
    setAuto(false);
    syncLibrary();
    setNotice({ tone: "warn", text: "Subida en pausa. Lo que se estaba subiendo termina; el resto queda en la lista, con sus búsquedas listas, para cuando la retomes." });
  }

  async function upload(item: Upload) {
    busy.current = true;
    patch(item.key, { status: "uploading", progress: 0, error: undefined });
    const choice = choiceFor(item);
    const target = choice === "replace" ? replaceTarget(item.duplicates) : null;
    const data = new FormData();
    if (target) {
      data.set("id", target.id);
      data.set("replace_audio", "1");
    }
    data.set("title", item.title.trim());
    data.set("artist", item.artist.trim());
    data.set("kind", item.kind);
    data.set("duration", String(item.duration));
    data.set("duck", item.duck ? "1" : "0");
    if (item.kind === "musica") {
      item.featured.map((name) => name.trim()).filter(Boolean).forEach((name) => data.append("featured[]", name));
      data.set("album", item.album.trim());
      item.genres.forEach((genre) => data.append("genre_ids[]", genre.id));
      data.set("year", item.year);
      if (item.cover) data.set("cover", item.cover, item.cover instanceof File ? item.cover.name : coverName(item.cover));
      else if (item.remoteCover) data.set("cover_url", item.remoteCover);
      if (item.identity) data.set("identity", item.identity);
      if (choice === "both") data.set("duplicate_ok", "1");
    }
    if (canEpisodes && item.episode && !target) {
      data.set("episode", "1");
      data.set("episode_description", item.description);
      if (item.episodeCover) data.set("episode_cover", item.episodeCover);
    }
    const result = await postAudio(LIBRARY, data, item.file, item.kind, (progress) => patch(item.key, { progress }));
    busy.current = false;
    if (result.error) {
      patch(item.key, { status: "ready", progress: 0, error: result.error, blocked: true, reviewedAs: null });
      return;
    }
    uploads.current.push(item.key);
    if (typeof result.id === "string") uploadedAs.current.set(item.key, result.id);
    const linked = new Set(batchMatches(item));
    setQueue((list) => list.map((other) => (other.reviewedAs && (linked.has(other.key) || batchMatches(other).includes(item.key)) ? { ...other, reviewedAs: null } : other)));
    if (target) tally.current.replaced++;
    else tally.current.uploaded++;
    tally.current.unsynced++;
    patch(item.key, { status: "done", progress: 1, replaced: target?.title ?? null });
    if (tally.current.unsynced >= RELOAD_EVERY || !running.current) syncLibrary();
  }

  /** Nothing is left to do on its own nor waits for the admin: the upload ends with its summary. */
  function finish() {
    const { uploaded, replaced } = tally.current;
    tally.current = { uploaded: 0, replaced: 0, unsynced: 0 };
    const skipped = queue.filter((item) => phase(item) === "skip").length;
    const unreadable = queue.filter((item) => phase(item) === "unreadable").length;
    setAuto(false);
    setQueue((list) => {
      const finished = (item: Upload) => item.status === "done" || phases.get(item.key) === "skip";
      list.filter(finished).forEach((item) => dropUrl(item.coverUrl));
      return list.filter((item) => !finished(item));
    });
    setNotice({
      tone: unreadable ? "warn" : "ok",
      text: [
        uploaded ? `Listo: ${uploaded === 1 ? "se subió 1 audio" : `se subieron ${uploaded} audios`} a la biblioteca.` : "",
        replaced ? `${replaced === 1 ? "Se reemplazó el audio de 1 canción" : `Se reemplazó el audio de ${replaced} canciones`}, que conservan sus datos y su programación.` : "",
        skipped ? `${skipped === 1 ? "1 canción repetida no se subió" : `${skipped} canciones repetidas no se subieron`}, como elegiste.` : "",
        unreadable ? `${unreadable === 1 ? "1 archivo no se pudo leer y sigue" : `${unreadable} archivos no se pudieron leer y siguen`} en la lista.` : "",
        uploaded || replaced ? "Nada suena hasta que lo programes o lo lances desde la consola." : "",
      ]
        .filter(Boolean)
        .join(" ") || "No había audios para subir.",
    });
  }

  /** Takes the admin to the next audio of a kind (they cycle), with its card highlighted and, if data is missing, the empty field ready to type. */
  function goTo(kind: string, items: Upload[]) {
    if (!items.length) return;
    const at = ((visited[kind] ?? -1) + 1) % items.length;
    const item = items[at];
    setVisited({ ...visited, [kind]: at });
    document.getElementById(`subida-${item.key}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    if (kind === "incomplete") document.getElementById(`subida-${item.key}-${missingField(item)}`)?.focus({ preventScroll: true });
    window.clearTimeout(flashTimer.current);
    setFlash(item.key);
    flashTimer.current = window.setTimeout(() => setFlash(null), 1800);
  }

  function onDrag(event: DragEvent, entering: boolean | null) {
    if (!Array.from(event.dataTransfer.types).includes("Files")) return;
    event.preventDefault();
    if (entering === true) depth.current++;
    if (entering === false) depth.current = Math.max(0, depth.current - 1);
    setDragging(depth.current > 0);
  }

  const active = queue.filter((item) => item.status !== "done");
  const done = queue.filter((item) => item.status === "done");
  const groups = groupRepeats(active);
  const grouped = new Set(groups.flat().map((item) => item.key));
  const rest = active.filter((item) => !grouped.has(item.key));
  const ordered = [...groups.flat(), ...rest];
  const inPhase = (...wanted: Phase[]) => ordered.filter((item) => wanted.includes(phase(item)));
  const incomplete = inPhase("incomplete");
  const verdicts = inPhase("verdict");
  const problems = inPhase("blocked", "unreadable");
  const repeats = active.filter(isRepeat);
  const toUpload = active.filter((item) => !["skip", "unreadable"].includes(phase(item))).length;
  const total = done.length + toUpload;
  const sending = active.find((item) => item.status === "uploading");
  const counts = Object.fromEntries((["reading", "searching", "checking", "queued", "skip"] as Phase[]).map((value) => [value, inPhase(value).length])) as Record<Phase, number>;
  const working = active.some((item) => WORKING.has(phase(item)));
  const nameOf = (key: string) => {
    const item = queue.find((entry) => entry.key === key);
    return item ? `«${item.title.trim() || item.file.name}» (${item.file.name})` : "otra canción";
  };
  const songs = queue.filter((item) => item.kind === "musica" && item.status !== "done");
  const position = (kind: string, items: Upload[]) => (visited[kind] !== undefined && items.length > 1 ? ` (${(visited[kind] % items.length) + 1} de ${items.length})` : "");

  const card = (item: Upload, grouped = false) => (
    <UploadCard
      key={item.key}
      item={item}
      phase={phase(item)}
      auto={auto}
      grouped={grouped}
      flash={flash === item.key}
      kinds={kinds}
      kindList={kindList}
      genres={genres}
      families={families}
      maxGenres={maxGenres}
      maxFeatured={maxFeatured}
      maxDescription={maxDescription}
      canEpisodes={canEpisodes}
      previewing={previewing === item.key}
      playing={previewing}
      nameOf={nameOf}
      onListen={listen}
      onPatch={(values) => edit(item, values)}
      onRetry={() => patch(item.key, { blocked: false, error: undefined })}
      onLookUp={() => lookUp(item.key, true)}
      onCover={(file) => setCover(item, file)}
      onPreview={() => togglePreview(item)}
      onRemove={() => remove(item)}
    />
  );

  /** Every row of the list as siblings, so a card keeps its place in the page (and the field being typed) when it moves into or out of a group. */
  const rows: ReactNode[] = [];
  if (groups.length) {
    rows.push(
      <div key="repeats" className={`rounded-2xl border p-3.5 text-[13px] leading-5 ${verdicts.length ? "border-amber-300 bg-amber-50 text-amber-950" : "border-emerald-200 bg-emerald-50 text-emerald-950"}`} role="status">
        <p className="font-semibold">
          {repeats.length === 1 ? "1 canción podría estar repetida." : `${repeats.length} canciones podrían estar repetidas.`}{" "}
          {verdicts.length ? `Las pusimos aquí, una tras otra y junto a la que ya está en la biblioteca, para que las compares y des tu veredicto${verdicts.length === repeats.length ? "" : ` (faltan ${verdicts.length})`}.` : "Ya diste tu veredicto en todas."}
        </p>
        <p className="mt-1 text-[12.5px] opacity-85">
          {auto ? "El resto se sigue subiendo mientras tanto: cada una de estas se sube (o no) apenas decidas." : "Al guardar, el resto se sube sin esperarlas: cada una de estas se sube (o no) apenas decidas."}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {verdicts.length ? (
            <button type="button" onClick={() => goTo("verdict", verdicts)} className="rounded-full bg-white px-3 py-1 text-[12px] font-semibold text-ink shadow-sm transition hover:bg-ink hover:text-white">
              Ir a la siguiente sin decidir{position("verdict", verdicts)}
            </button>
          ) : null}
          {repeats.length > 1 ? (
            <>
              <button type="button" onClick={() => decideAll("skip")} className="rounded-full bg-white px-3 py-1 text-[12px] font-semibold text-ink shadow-sm transition hover:bg-ink hover:text-white">
                No subir ninguna repetida
              </button>
              <button type="button" onClick={() => decideAll("both")} className="rounded-full bg-white px-3 py-1 text-[12px] font-semibold text-ink shadow-sm transition hover:bg-ink hover:text-white">
                Guardar todas igual
              </button>
            </>
          ) : null}
        </div>
      </div>,
    );
    groups.forEach((group, index) => {
      const same = group.some((item) => concerns(item.duplicates).some((match) => match.verdict === "misma"));
      const twins = new Set<string>();
      rows.push(
        <div key={`group-${group[0].key}`} className="flex flex-wrap items-center gap-2 pt-3 text-[11.5px] font-semibold text-muted">
          <span className="rounded-full bg-ink px-2.5 py-0.5 text-white">Grupo {index + 1} de {groups.length}</span>
          <span className={same ? "text-red-800" : "text-amber-900"}>{same ? "La misma canción" : "Posible duplicado"}</span>
          <span>· {group.length > 1 ? `${group.length} canciones de esta subida` : "con una de la biblioteca"}</span>
        </div>,
      );
      group.forEach((item) => {
        concerns(item.duplicates).forEach((match) => {
          if (!match.track || twins.has(match.track.id)) return;
          twins.add(match.track.id);
          rows.push(<LibraryTwin key={`twin-${group[0].key}-${match.track.id}`} match={match} playing={previewing} onListen={listen} />);
        });
        rows.push(card(item, true));
      });
    });
    if (rest.length) {
      rows.push(
        <p key="rest" className="pt-4 text-[11.5px] font-semibold uppercase tracking-[0.08em] text-muted">
          Resto de la subida · {rest.length}
        </p>,
      );
    }
  }
  rest.forEach((item) => rows.push(card(item)));
  if (done.length) {
    rows.push(
      <details key="done" className="rounded-2xl border border-emerald-200 bg-emerald-50/50 px-4 py-3">
        <summary className="cursor-pointer text-[13px] font-semibold text-emerald-900">Ya subidas a la biblioteca · {done.length} ✓</summary>
        <ul className="mt-2 max-h-72 space-y-1 overflow-y-auto pr-1 text-[12.5px]">
          {done.map((item) => (
            <li key={item.key} className="flex items-center gap-2.5 rounded-lg bg-white/70 px-2.5 py-1.5">
              {item.coverUrl ? <img src={item.coverUrl} alt="" className="h-7 w-7 shrink-0 rounded object-cover" /> : <span className="grid h-7 w-7 shrink-0 place-items-center rounded bg-paper text-muted">♪</span>}
              <span className="min-w-0 flex-1 truncate">
                <b className="font-semibold">{item.title}</b>
                {item.artist ? <span className="text-muted"> · {item.artist}</span> : null}
              </span>
              <span className="shrink-0 text-[11.5px] font-semibold text-emerald-800">{item.replaced ? `Reemplazó «${item.replaced}»` : "Subida ✓"}</span>
            </li>
          ))}
        </ul>
      </details>,
    );
  }

  return (
    <section
      className={`relative mt-6 rounded-[1.6rem] border-2 border-dashed p-5 transition md:p-6 ${dragging ? "border-accent bg-orange-50/60" : "border-line bg-card"}`}
      onDragEnter={(event) => onDrag(event, true)}
      onDragOver={(event) => onDrag(event, null)}
      onDragLeave={(event) => onDrag(event, false)}
      onDrop={(event) => {
        onDrag(event, null);
        depth.current = 0;
        setDragging(false);
        addFiles(event.dataTransfer.files);
      }}
    >
      {dragging ? (
        <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center rounded-[1.5rem] bg-white/80 backdrop-blur-[2px]">
          <p className="flex items-center gap-3 text-lg font-semibold tracking-[-0.02em] text-orange-deep">
            <MusicNote className="h-7 w-7" /> Suelta aquí tus audios
          </p>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-[-0.025em]">Subir audios</h2>
          <p className="mt-1 text-[13px] leading-5 text-muted">
            Arrastra aquí tus archivos o elígelos. MP3, M4A, AAC, OGG, OPUS, WAV o FLAC · hasta {maxMb} MB cada uno.
          </p>
          <p className="mt-1 text-[12.5px] font-medium text-emerald-800">Nada empieza a sonar al subir: todo queda guardado para programarlo.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={uploadKind} onChange={(event) => setUploadKind(event.target.value as Kind)} className={`${input} !mt-0 !w-auto`} aria-label="Tipo de los audios que agregas">
            {kindList.map((kind) => (
              <option key={kind} value={kind}>
                Subir como: {kinds[kind]}
              </option>
            ))}
          </select>
          <button type="button" onClick={() => picker.current?.click()} className={button}>
            Elegir archivos
          </button>
          <input
            ref={picker}
            type="file"
            accept={AUDIO_ACCEPT}
            multiple
            hidden
            onChange={(event) => {
              addFiles(event.target.files);
              event.target.value = "";
            }}
          />
        </div>
      </div>

      {notice ? (
        <p className={`mt-4 rounded-xl px-3.5 py-2.5 text-[13px] font-medium ${notice.tone === "ok" ? "bg-emerald-50 text-emerald-900" : "bg-amber-50 text-amber-900"}`} role="status">
          {notice.text}
        </p>
      ) : null}

      {queue.length === 0 ? (
        <button
          type="button"
          onClick={() => picker.current?.click()}
          className="mt-5 grid w-full place-items-center gap-2 rounded-2xl border border-line bg-white/70 px-6 py-10 text-center transition hover:border-ink/25 hover:bg-white"
        >
          <span className="grid h-14 w-14 place-items-center rounded-full bg-orange-50 text-orange-deep">
            <MusicNote className="h-7 w-7" />
          </span>
          <span className="text-[15px] font-semibold">Arrastra tus canciones aquí o haz clic para elegirlas</span>
          <span className="max-w-lg text-[12.5px] leading-5 text-muted">
            Reconocemos solos el nombre, el autor y los coautores de cada canción, y la buscamos en internet para completar su álbum, año, estilos musicales y carátula. Si el archivo no trae datos, los tomamos de su nombre («Autor - Canción.mp3»).
          </span>
        </button>
      ) : (
        <div className="mt-5 space-y-3">
          {songs.length > 1 ? (
            <div className="rounded-2xl border border-line bg-paper/70 p-3">
              <p className="text-xs font-semibold text-muted">Completar en todas las canciones (por ejemplo, si son del mismo álbum)</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_5.5rem_auto]">
                <input value={bulk.artist} onChange={(event) => setBulk({ ...bulk, artist: event.target.value })} placeholder="Autor" maxLength={120} className={small} aria-label="Autor para todas" />
                <input value={bulk.album} onChange={(event) => setBulk({ ...bulk, album: event.target.value })} placeholder="Álbum" maxLength={160} className={small} aria-label="Álbum para todas" />
                <input value={bulk.year} onChange={(event) => setBulk({ ...bulk, year: cleanYear(event.target.value) })} placeholder="Año" inputMode="numeric" className={small} aria-label="Año para todas" />
                <button type="button" disabled={!(bulk.artist.trim() || bulk.album.trim() || bulk.genres.length || bulk.year)} onClick={applyToAll} className={`${ghost} !py-2`}>
                  Aplicar a todas
                </button>
              </div>
              <div className="mt-2">
                <GenrePicker value={bulk.genres} onChange={(value) => setBulk({ ...bulk, genres: value })} genres={genres} families={families} max={maxGenres} />
              </div>
            </div>
          ) : null}

          {rows}

          <div className="sticky bottom-3 z-10 !mt-5 rounded-2xl border border-line bg-white/95 p-3.5 shadow-[0_18px_40px_-24px_rgba(42,39,36,0.45)] backdrop-blur md:p-4">
            {auto || done.length ? (
              <div className="mb-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2 text-[12.5px]">
                  <span className="font-semibold">
                    {auto ? (working ? "Subida en curso" : "Subida en curso · esperando por ti") : "Subida en pausa"}
                    <span className="font-normal text-muted"> · {done.length} de {total} en la biblioteca</span>
                  </span>
                  {sending ? (
                    <span className="min-w-0 max-w-full truncate text-muted">
                      Subiendo «{sending.title.trim() || sending.file.name}» · {Math.round(sending.progress * 100)}%
                    </span>
                  ) : null}
                </div>
                <span className="mt-1.5 block h-2 overflow-hidden rounded-full bg-paper">
                  <span className="block h-full rounded-full bg-emerald-500 transition-[width] duration-500" style={{ width: `${total ? Math.round((done.length / total) * 100) : 0}%` }} />
                </span>
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-2.5">
              {auto ? (
                <button type="button" onClick={pause} className={ghost}>
                  Pausar la subida
                </button>
              ) : (
                <button type="button" disabled={toUpload === 0} onClick={start} className={button}>
                  {done.length ? "Seguir subiendo" : "Guardar"} {plural(toUpload, "audio", "audios")} en la biblioteca
                </button>
              )}
              <button type="button" disabled={auto} onClick={clear} className={ghost}>
                Limpiar lista
              </button>
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 text-[12px]">
                {counts.reading ? <Chip tone="bg-paper text-ink/80">Reconociendo {counts.reading}</Chip> : null}
                {counts.searching ? <Chip tone="animate-pulse bg-blue-50 text-blue-800">Buscando en internet {counts.searching}</Chip> : null}
                {counts.checking ? <Chip tone="bg-sky-50 text-sky-800">Revisando repetidas {counts.checking}</Chip> : null}
                {counts.queued ? <Chip tone="bg-emerald-50 text-emerald-800">{auto ? "En cola para subir" : "Listos para subir"} {counts.queued}</Chip> : null}
                {done.length ? <Chip tone="bg-emerald-100 text-emerald-900">Subidos {done.length} ✓</Chip> : null}
                {incomplete.length ? (
                  <Chip tone="bg-amber-100 text-amber-900 hover:bg-amber-200" onClick={() => goTo("incomplete", incomplete)}>
                    Completa los datos obligatorios en {plural(incomplete.length, "audio", "audios")}{position("incomplete", incomplete)} · Ir →
                  </Chip>
                ) : null}
                {verdicts.length ? (
                  <Chip tone="bg-red-100 text-red-900 hover:bg-red-200" onClick={() => goTo("verdict", verdicts)}>
                    {plural(verdicts.length, "repetida espera", "repetidas esperan")} tu veredicto{position("verdict", verdicts)} · Ir →
                  </Chip>
                ) : null}
                {problems.length ? (
                  <Chip tone="bg-red-50 text-red-800 hover:bg-red-100" onClick={() => goTo("problem", problems)}>
                    {plural(problems.length, "audio con error", "audios con error")}{position("problem", problems)} · Ir →
                  </Chip>
                ) : null}
                {counts.skip ? <Chip tone="bg-slate-100 text-slate-700">No se subirán {counts.skip}</Chip> : null}
              </div>
            </div>
            <p className="mt-2 text-[11.5px] leading-4 text-muted">
              {auto && !working && (incomplete.length || verdicts.length || problems.length)
                ? "Todo lo demás ya está en la biblioteca. Apenas completes los datos, des tu veredicto o corrijas lo que falló, se sube solo."
                : auto
                  ? "Cada audio se sube solo, uno por uno, apenas terminan su búsqueda en internet (álbum, año, estilos y carátula) y la revisión de repetidas. Puedes seguir revisando y agregando audios mientras tanto."
                  : "Al guardar, cada audio se sube solo apenas terminen su búsqueda en internet (álbum, año, estilos y carátula) y la revisión de repetidas; las que podrían estar repetidas esperan tu veredicto."}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

function Chip({ tone, onClick, children }: { tone: string; onClick?: () => void; children: ReactNode }) {
  const className = `rounded-full px-2.5 py-1 font-semibold transition ${tone}`;
  return onClick ? (
    <button type="button" onClick={onClick} className={className}>
      {children}
    </button>
  ) : (
    <span className={className}>{children}</span>
  );
}

const SOURCE: Record<SongDetails["source"], { text: string; tone: string; hint: string }> = {
  tags: { text: "✓ Reconocida del archivo", tone: "bg-emerald-50 text-emerald-800", hint: "Los datos vienen de las etiquetas del archivo. Revísalos si quieres." },
  name: { text: "Tomada del nombre del archivo", tone: "bg-amber-50 text-amber-800", hint: "El archivo no traía etiquetas: el nombre y el autor salen del nombre del archivo. Revísalos." },
  none: { text: "Sin datos en el archivo", tone: "bg-slate-100 text-slate-700", hint: "No encontramos el nombre ni el autor: complétalos." },
};

/** Where the card stands, when its other badges do not say it already. */
const PHASE_BADGE: Partial<Record<Phase, { text: string; tone: string }>> = {
  checking: { text: "Revisando si está repetida…", tone: "animate-pulse bg-sky-50 text-sky-800" },
  blocked: { text: "No se pudo subir", tone: "bg-red-100 text-red-800" },
  incomplete: { text: "Faltan datos", tone: "bg-amber-100 text-amber-900" },
};

function UploadCard({
  item,
  phase,
  auto,
  grouped,
  flash,
  kinds,
  kindList,
  genres,
  families,
  maxGenres,
  maxFeatured,
  maxDescription,
  canEpisodes,
  previewing,
  playing,
  nameOf,
  onListen,
  onPatch,
  onRetry,
  onLookUp,
  onCover,
  onPreview,
  onRemove,
}: {
  item: Upload;
  phase: Phase;
  auto: boolean;
  /** Shown inside a group of songs that may repeat each other. */
  grouped: boolean;
  /** Just reached from the summary: it stands out for a moment. */
  flash: boolean;
  kinds: Record<Kind, string>;
  kindList: Kind[];
  genres: RadioGenre[];
  families: Record<string, string>;
  maxGenres: number;
  maxFeatured: number;
  maxDescription: number;
  canEpisodes: boolean;
  previewing: boolean;
  /** What the upload's player is playing, to mark the repeated song being heard. */
  playing: string | null;
  nameOf: (key: string) => string;
  onListen: (match: DuplicateMatch) => void;
  onPatch: (values: Partial<Upload>) => void;
  onRetry: () => void;
  onLookUp: () => void;
  onCover: (file: File | null) => void;
  onPreview: () => void;
  onRemove: () => void;
}) {
  const song = item.kind === "musica";
  const locked = item.status === "reading" || item.status === "uploading" || item.status === "done";
  const searching = item.lookup?.status === "searching";
  const problem = item.status === "ready" ? missing(item) : null;
  const source = song && item.source ? SOURCE[item.source] : null;
  const required = <span className="text-red-600">*</span>;
  const titleMissing = item.status === "ready" && !item.title.trim();
  const artistMissing = item.status === "ready" && song && !item.artist.trim();
  const yearWrong = item.status === "ready" && Boolean(item.year) && item.year.length !== 4;
  const shade = song && item.status === "ready" ? duplicateShade(item.duplicates, item.decision) : null;
  const badge = phase === "queued" ? { text: auto ? "En cola para subir" : "Lista para subir", tone: "bg-emerald-50 text-emerald-800" } : PHASE_BADGE[phase];

  return (
    <article
      id={`subida-${item.key}`}
      className={`scroll-mt-24 rounded-2xl border p-3 transition md:p-4 ${grouped ? "md:ml-4" : ""} ${flash ? "ring-4 ring-accent/45" : ""} ${item.error ? "border-red-200 bg-white" : (shade ?? (problem ? "border-amber-300 bg-amber-50/30" : "border-line bg-white"))}`}
    >
      <div className="flex gap-3 md:gap-4">
        {song ? <CoverPicker src={item.coverUrl} disabled={locked} onPick={(file) => onCover(file)} onRemove={() => onCover(null)} /> : null}

        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-[11.5px] text-muted">
            <span className="min-w-0 max-w-full truncate font-medium text-ink/70" title={item.file.name}>
              {item.file.name}
            </span>
            <span className="tabular-nums">· {sizeLabel(item.file.size)}</span>
            <span className="font-mono tabular-nums">· {item.duration ? duration(item.duration) : "--:--"}</span>
            {item.status === "reading" ? <span className="animate-pulse rounded-full bg-paper px-2 py-0.5 font-semibold">{song ? "Reconociendo la canción…" : "Leyendo el audio…"}</span> : null}
            {source && item.status !== "reading" ? (
              <span className={`rounded-full px-2 py-0.5 font-semibold ${source.tone}`} title={source.hint}>
                {source.text}
              </span>
            ) : null}
            {song ? <LookupBadge state={item.lookup} /> : null}
            {song && item.status === "ready" ? <DuplicateBadge review={item.duplicates} decision={item.decision} /> : null}
            {badge ? <span className={`rounded-full px-2 py-0.5 font-semibold ${badge.tone}`}>{badge.text}</span> : null}
            <span className="ml-auto flex items-center gap-1">
              {song && !locked && !searching && item.title.trim().length >= 2 ? (
                <button
                  type="button"
                  onClick={onLookUp}
                  className="inline-flex items-center gap-1 rounded-full bg-paper px-2.5 py-1 text-[11px] font-semibold text-ink transition hover:bg-ink hover:text-white"
                  title="Vuelve a buscar la canción en internet con el nombre y el autor de ahora, y reemplaza el álbum, el año, los estilos y la carátula encontrados."
                >
                  <SearchIcon className="h-3 w-3" /> Buscar en internet
                </button>
              ) : null}
              {song && !locked && (item.title.trim() || item.artist.trim()) ? (
                <button
                  type="button"
                  onClick={() => onPatch({ title: item.artist, artist: item.title })}
                  className="rounded-full bg-paper px-2.5 py-1 text-[11px] font-semibold text-ink transition hover:bg-ink hover:text-white"
                  title="Si el nombre de la canción y el autor salieron al revés, cámbialos de lugar."
                >
                  ⇄ Intercambiar nombre y autor
                </button>
              ) : null}
              {item.duration ? (
                <button type="button" onClick={onPreview} className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${previewing ? "bg-ink text-white" : "bg-paper text-ink hover:bg-ink hover:text-white"}`}>
                  {previewing ? "■ Detener" : "▶ Escuchar"}
                </button>
              ) : null}
              {item.status === "uploading" || item.status === "done" ? null : (
                <button type="button" onClick={onRemove} className="px-1.5 text-lg leading-none text-muted hover:text-red-700" aria-label="Quitar de la lista">
                  ×
                </button>
              )}
            </span>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-xs font-semibold text-muted">
              {song ? "Nombre de la canción" : "Nombre"} {required}
              <input
                id={`subida-${item.key}-title`}
                value={item.title}
                disabled={locked}
                onChange={(event) => onPatch({ title: event.target.value })}
                placeholder={song ? "Ej.: Renuévame" : "Ej.: Retiro de jóvenes"}
                maxLength={160}
                className={`${small} mt-1.5 ${titleMissing ? "!border-red-300 !bg-red-50/40" : ""}`}
              />
            </label>
            <label className="text-xs font-semibold text-muted">
              {song ? (
                <>
                  Autor {required}
                </>
              ) : item.kind === "programa" ? (
                "Programa o locutor (opcional)"
              ) : (
                "Autor (opcional)"
              )}
              <input
                id={`subida-${item.key}-artist`}
                value={item.artist}
                disabled={locked}
                onChange={(event) => onPatch({ artist: event.target.value })}
                placeholder={song ? "Ej.: Marcos Witt" : ""}
                maxLength={120}
                className={`${small} mt-1.5 ${artistMissing ? "!border-red-300 !bg-red-50/40" : ""}`}
              />
            </label>
          </div>

          {song ? (
            <>
              <CoAuthorsField value={item.featured} onChange={(featured) => onPatch({ featured })} max={maxFeatured} disabled={locked} />
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_6rem]">
                <label className="text-xs font-semibold text-muted">
                  Álbum <span className="font-normal">(opcional)</span>
                  <input value={item.album} disabled={locked} onChange={(event) => onPatch({ album: event.target.value })} placeholder="Ej.: Sigues siendo Dios" maxLength={160} className={`${small} mt-1.5`} />
                </label>
                <label className="text-xs font-semibold text-muted">
                  Año
                  <input
                    id={`subida-${item.key}-year`}
                    value={item.year}
                    disabled={locked}
                    onChange={(event) => onPatch({ year: cleanYear(event.target.value) })}
                    placeholder="2024"
                    inputMode="numeric"
                    className={`${small} mt-1.5 ${yearWrong ? "!border-red-300 !bg-red-50/40" : ""}`}
                  />
                </label>
              </div>
              <div>
                <span className="text-xs font-semibold text-muted">
                  Estilos musicales <span className="font-normal">(hasta {maxGenres}; el primero es el principal)</span>
                </span>
                <div className="mt-1.5">
                  <GenrePicker value={item.genres} onChange={(value) => onPatch({ genres: value })} genres={genres} families={families} max={maxGenres} disabled={locked} />
                </div>
              </div>
            </>
          ) : null}

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <label className="flex items-center gap-2 text-xs font-semibold text-muted">
              Tipo
              <select
                value={item.kind}
                disabled={locked}
                onChange={(event) => onPatch({ kind: event.target.value as Kind, duck: duckFor(event.target.value as Kind) })}
                className={`${input} !mt-0 !w-auto !py-1.5 text-[13px]`}
              >
                {kindList.map((kind) => (
                  <option key={kind} value={kind}>
                    {kinds[kind]}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-xs" title="Cuando suene encima de la música, la música baja para que se escuche mejor.">
              <input type="checkbox" checked={item.duck} disabled={locked} onChange={(event) => onPatch({ duck: event.target.checked })} /> Baja la música cuando suena encima
            </label>
          </div>

          {canEpisodes ? (
            <div>
              <label className="inline-flex items-center gap-2 text-[13px] font-semibold">
                <input type="checkbox" checked={item.episode} disabled={locked} onChange={(event) => onPatch({ episode: event.target.checked })} />
                Publicar también como episodio en la página de la radio
              </label>
              {item.episode ? (
                <div className="mt-2 grid gap-3 rounded-xl bg-paper p-3 md:grid-cols-[minmax(0,1fr)_16rem]">
                  <label className="text-xs font-semibold text-muted">
                    Descripción corta del programa
                    <textarea
                      value={item.description}
                      disabled={locked}
                      onChange={(event) => onPatch({ description: event.target.value })}
                      maxLength={maxDescription}
                      rows={2}
                      placeholder="De qué trata este programa, en una o dos frases."
                      className={`${input} resize-none`}
                    />
                    <span className="mt-1 block text-right text-[11px] font-normal tabular-nums">
                      {item.description.length}/{maxDescription}
                    </span>
                  </label>
                  <label className="text-xs font-semibold text-muted">
                    Carátula del episodio (opcional)
                    <input
                      type="file"
                      accept={COVER_ACCEPT}
                      disabled={locked}
                      onChange={(event) => onPatch({ episodeCover: event.target.files?.[0] ?? null })}
                      className={`${input} file:mr-3 file:rounded-full file:border-0 file:bg-paper file:px-3 file:py-1 file:text-xs file:font-semibold`}
                    />
                    <span className="mt-1 block text-[11px] font-normal">JPG, PNG o WEBP cuadrada · hasta 8 MB</span>
                  </label>
                </div>
              ) : null}
            </div>
          ) : null}

          {item.status === "uploading" || item.status === "done" ? (
            <div className="flex items-center gap-3">
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-paper">
                <span className="block h-full rounded-full bg-accent transition-[width]" style={{ width: `${Math.round(item.progress * 100)}%` }} />
              </span>
              <span className="w-24 text-right text-[11.5px] font-semibold tabular-nums text-muted">{item.status === "done" ? "Subido ✓" : `Subiendo ${Math.round(item.progress * 100)}%`}</span>
            </div>
          ) : null}
          {song && item.status === "ready" ? (
            <DuplicatePanel review={item.duplicates} decision={item.decision} disabled={locked} nameOf={nameOf} playing={playing} onListen={onListen} onChoose={(decision) => onPatch({ decision })} />
          ) : null}
          {item.error ? (
            <p className="flex flex-wrap items-center gap-2 text-xs font-medium text-red-700">
              {item.error}
              {item.blocked && !problem ? (
                <button type="button" onClick={onRetry} className="rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-800 transition hover:bg-red-600 hover:text-white">
                  Reintentar
                </button>
              ) : null}
            </p>
          ) : null}
          {problem ? <p className="text-xs font-medium text-amber-800">{problem}</p> : null}
        </div>
      </div>
    </article>
  );
}
