import { router } from "@inertiajs/react";
import { useSyncExternalStore } from "react";
import { COVER_ACCEPT, readDuration } from "@/Components/radio/admin-ui";
import { postAudio } from "@/Components/radio/audio-upload";
import type { RadioGenre, RadioTrack } from "@/lib/radio";
import { artistHints, parseFileName, recognizeSong, type SongDetails } from "@/lib/radio/audio-tags";
import { choiceOf, concernKey, concerns, decide, isPending, needsDecision, replaceTarget, reviewDuplicates, type DuplicateChoice, type DuplicateDecision, type DuplicateReview } from "./duplicates";
import { identifySong, identityJson, mergeNames, plain, type LookupState } from "./song-fields";

export type Kind = RadioTrack["kind"];

export type Upload = {
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
export type Phase = "reading" | "searching" | "checking" | "incomplete" | "verdict" | "blocked" | "skip" | "queued" | "uploading" | "done" | "unreadable";

/** Whether the review of repeated songs covers the song as the list is now, or was given up after failing several times in a row. */
type ReviewState = { fresh: boolean; gaveUp: boolean };

/** `final`: the summary of an upload that ended, shown wherever the admin is. */
export type Notice = { tone: "ok" | "warn"; text: string; final?: boolean };

export type UploadState = {
  queue: Upload[];
  /** The upload is running: audios go up on their own. */
  auto: boolean;
  notice: Notice | null;
  reviewFailures: number;
  /** The library page is open and shows the upload. */
  viewing: boolean;
};

/** Where every audio stands, and the songs whose duplicate review is due (to know when to ask). */
export type Progress = { phases: Map<string, Phase>; pendingReview: string };

/** The upload at a glance, for its progress bar. */
export type Summary = { done: number; total: number; sending: Upload | undefined; working: boolean; waiting: number };

const LIBRARY = "/admin/radio/biblioteca";
const AUDIO_FILE = /\.(mp3|m4a|aac|ogg|oga|opus|wav|webm|flac)$/i;
const MAX_COVER_BYTES = 8 * 1024 * 1024;
/** Pause between a change and its review, so the changes of that moment are asked about together. */
const REVIEW_DELAY_MS = 900;
const REVIEW_RETRY_MS = 5000;
/** Failed reviews in a row before uploading without it (the server still refuses an exact repeat). */
const REVIEW_ATTEMPTS = 3;
/** Songs judged per review, the first of the list first since they go up first: each one is compared with the whole library. */
const REVIEW_CHUNK = 40;
const LOOKUP_ATTEMPTS = 3;
const LOOKUP_RETRY_MS = 2500;
/** Uploads between refreshes of the library list, during a long upload. */
const RELOAD_EVERY = 15;
/** Phases that move on by themselves. */
export const WORKING = new Set<Phase>(["reading", "searching", "checking", "queued", "uploading"]);
/** Phases that wait for the admin. */
export const WAITING = new Set<Phase>(["incomplete", "verdict", "blocked"]);

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Spoken audio lowers the music by default when it plays on top of it. */
export const duckFor = (kind: Kind) => kind === "anuncio" || kind === "programa";

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

/** What keeps an audio from being uploaded, or null when it is complete. */
export function missing(item: Upload) {
  if (!item.title.trim()) return item.kind === "musica" ? "Falta el nombre de la canción." : "Falta el nombre del audio.";
  if (item.kind === "musica" && !item.artist.trim()) return "Falta el autor de la canción.";
  if (item.year && item.year.length !== 4) return "El año va con 4 cifras (por ejemplo 2024).";
  return null;
}

/** The field to fill first in an incomplete audio. */
export function missingField(item: Upload) {
  if (!item.title.trim()) return "title";
  if (item.kind === "musica" && !item.artist.trim()) return "artist";
  return "year";
}

const isSongReady = (item: Upload) => item.kind === "musica" && item.status === "ready";

/** The admin's choice for a song that may repeat another, as it is reviewed now. */
const choiceFor = (item: Upload): DuplicateChoice | null => (item.kind === "musica" ? choiceOf(item.duplicates, item.decision) : null);

/** A song not uploaded yet that may repeat another, whether or not the admin decided already. */
export const isRepeat = (item: Upload) => item.kind === "musica" && (item.status === "ready" || item.status === "uploading") && needsDecision(item.duplicates);

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
export function groupRepeats(active: Upload[]): Upload[][] {
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
  } else {
    if (result.title && untouched("title") && (force || current.source !== "tags")) next.title = result.title;
    if (result.artist && untouched("artist")) next.artist = result.artist;
  }
  const sameGenres = current.genres.map((genre) => genre.id).join() === base.genres.map((genre) => genre.id).join();
  if (result.genres.length && sameGenres && (force || current.genres.length === 0)) next.genres = result.genres.slice(0, limits.genres);
  return next;
}

const keepPage = (event: BeforeUnloadEvent) => event.preventDefault();

/**
 * The library's upload, kept outside the page: it goes on while the admin moves through the panel's sections or
 * looks at another browser tab, and only stops if the panel itself is closed or reloaded (the browser asks first).
 * «Guardar» starts it: every audio goes up, one at a time, as soon as its search and its duplicate review end;
 * songs that may repeat another wait for the admin's verdict, and incomplete ones for their data.
 */
class UploadQueue {
  private state: UploadState = { queue: [], auto: false, notice: null, reviewFailures: 0, viewing: false };
  private listeners = new Set<() => void>();
  private derived: { queue: Upload[]; failures: number; progress: Progress } | null = null;
  private limits = { featured: 4, genres: 3, canEpisodes: false };
  private lookups: Promise<void> = Promise.resolve();
  private asking = false;
  private reviewTimer = 0;
  private retry = 0;
  private busy = false;
  private pumpQueued = false;
  private guarding = false;
  private releaseLock: (() => void) | null = null;
  private urls = new Set<string>();
  /** Library id each song of this upload got, by its key. */
  private uploadedAs = new Map<string, string>();
  /** Keys of the songs uploaded, in the order they went up. */
  private uploadOrder: string[] = [];
  private tally = { uploaded: 0, replaced: 0, unsynced: 0 };

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  snapshot = () => this.state;

  progress(): Progress {
    const { queue, reviewFailures } = this.state;
    if (this.derived?.queue !== queue || this.derived.failures !== reviewFailures) {
      const contexts = reviewContexts(queue);
      const gaveUp = reviewFailures >= REVIEW_ATTEMPTS;
      const phases = new Map(queue.map((item) => [item.key, phaseOf(item, { fresh: item.reviewedAs === contexts.get(item.key), gaveUp })]));
      const pendingReview = queue
        .filter((item) => needsReview(item, contexts))
        .slice(0, REVIEW_CHUNK)
        .map((item) => contexts.get(item.key))
        .join();
      this.derived = { queue, failures: reviewFailures, progress: { phases, pendingReview } };
    }
    return this.derived.progress;
  }

  summary(): Summary {
    const { phases } = this.progress();
    const phase = (item: Upload) => phases.get(item.key) as Phase;
    const { queue } = this.state;
    const done = queue.filter((item) => item.status === "done").length;
    const toUpload = queue.filter((item) => item.status !== "done" && !["skip", "unreadable"].includes(phase(item))).length;
    return {
      done,
      total: done + toUpload,
      sending: queue.find((item) => item.status === "uploading"),
      working: queue.some((item) => WORKING.has(phase(item))),
      waiting: queue.filter((item) => WAITING.has(phase(item))).length,
    };
  }

  configure(limits: { featured: number; genres: number; canEpisodes: boolean }) {
    this.limits = limits;
  }

  /** The library page shows the upload while it is open: its list of audios is refreshed as they go up. */
  view() {
    this.tally.unsynced = 0;
    this.set({ viewing: true });
    return () => this.set({ viewing: false });
  }

  setNotice(notice: Notice | null) {
    this.set({ notice });
  }

  objectUrl(blob: Blob) {
    const url = URL.createObjectURL(blob);
    this.urls.add(url);
    return url;
  }

  dropUrl(url: string | null) {
    if (!url || !this.urls.has(url)) return;
    URL.revokeObjectURL(url);
    this.urls.delete(url);
  }

  patch(key: string, values: Partial<Upload>) {
    this.update((list) => list.map((item) => (item.key === key ? { ...item, ...values } : item)));
  }

  /** A change made by the admin: a failed upload may go up again with it. */
  edit(key: string, values: Partial<Upload>) {
    const item = this.state.queue.find((entry) => entry.key === key);
    if (item) this.patch(key, item.status === "ready" ? { ...values, blocked: false, error: undefined } : values);
  }

  /** One song at a time, so the music services are asked politely; each one reads the song as it is when its turn comes, and a failed search is tried again. */
  lookUp(key: string, force = false) {
    this.patch(key, { lookup: { status: "searching" } });
    this.lookups = this.lookups.then(async () => {
      const base = this.state.queue.find((item) => item.key === key);
      if (!base || base.kind !== "musica" || base.status !== "ready" || base.title.trim().length < 2) {
        this.patch(key, { lookup: null });
        return;
      }
      const song = { title: base.title, artist: base.artist, featured: base.featured, duration: base.duration, genre: base.tagGenre };
      let state = await identifySong(song);
      for (let attempt = 1; state.status === "error" && attempt < LOOKUP_ATTEMPTS; attempt++) {
        await wait(LOOKUP_RETRY_MS * attempt);
        if (!this.state.queue.some((item) => item.key === key)) return;
        state = await identifySong(song);
      }
      this.update((list) => list.map((item) => (item.key === key ? fill(item, base, state, force, this.limits) : item)));
    });
  }

  addFiles(list: FileList | File[] | null, options: { kind: Kind; maxMb: number; knownArtists: string[] }) {
    if (!list?.length) return;
    const { kind, maxMb, knownArtists } = options;
    const { queue } = this.state;
    const files = Array.from(list);
    const audio = files.filter((file) => AUDIO_FILE.test(file.name) || file.type.startsWith("audio/"));
    const known = new Set(queue.map((item) => `${item.file.name}:${item.file.size}`));
    const fresh = audio.filter((file) => !known.has(`${file.name}:${file.size}`));
    const skipped = files.length - audio.length;
    const repeated = audio.length - fresh.length;
    this.setNotice(
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
        kind,
        duck: duckFor(kind),
        duration: null,
        progress: 0,
        status: tooBig ? "error" : "reading",
        error: tooBig ? `Pesa más de ${maxMb} MB. Expórtalo en MP3 (128–192 kbps).` : undefined,
        blocked: false,
        title: guess.title,
        artist: kind === "musica" ? guess.artist : "",
        featured: kind === "musica" ? guess.featured : [],
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
    this.update((current) => [...current, ...items]);

    items
      .filter((item) => item.status === "reading")
      .forEach(async (item) => {
        const [seconds, details] = await Promise.all([readDuration(item.file), recognizeSong(item.file, hints)]);
        if (!seconds) {
          this.patch(item.key, { status: "error", error: "No pudimos leer este audio. Prueba con MP3 o M4A." });
          return;
        }
        this.patch(item.key, {
          duration: seconds,
          status: "ready",
          title: details.title || item.title,
          artist: details.artist,
          featured: details.featured.slice(0, this.limits.featured),
          album: details.album,
          year: details.year,
          tagGenre: details.genre,
          cover: details.cover,
          coverUrl: details.cover ? this.objectUrl(details.cover) : null,
          source: details.source,
        });
        if (item.kind === "musica" && (details.title || item.title).trim().length >= 2) this.lookUp(item.key);
      });
  }

  remove(key: string) {
    this.dropUrl(this.state.queue.find((item) => item.key === key)?.coverUrl ?? null);
    this.update((list) => list.filter((entry) => entry.key !== key));
  }

  clear() {
    this.state.queue.forEach((item) => this.dropUrl(item.coverUrl));
    this.set({ queue: [], notice: null });
    this.syncLibrary();
  }

  setCover(key: string, file: File | null) {
    if (file && (file.size > MAX_COVER_BYTES || !COVER_ACCEPT.split(",").includes(file.type))) {
      this.setNotice({ tone: "warn", text: "La carátula debe ser una imagen JPG, PNG o WEBP de hasta 8 MB." });
      return;
    }
    this.dropUrl(this.state.queue.find((item) => item.key === key)?.coverUrl ?? null);
    this.edit(key, { cover: file, coverUrl: file ? this.objectUrl(file) : null, remoteCover: null });
  }

  /** The same choice for every song that may repeat another, for long uploads. */
  decideAll(choice: DuplicateChoice) {
    this.update((list) => list.map((item) => (isSongReady(item) && needsDecision(item.duplicates) ? { ...item, decision: decide(item.duplicates, choice), blocked: false, error: undefined } : item)));
  }

  applyToAll(values: Partial<Upload>) {
    this.update((list) => list.map((item) => (item.kind === "musica" && (item.status === "ready" || item.status === "error") ? { ...item, ...values, blocked: false } : item)));
  }

  start() {
    this.set({ notice: null, auto: true, queue: this.state.queue.map((item) => (item.blocked ? { ...item, blocked: false } : item)) });
  }

  pause() {
    this.set({ auto: false, notice: { tone: "warn", text: "Subida en pausa. Lo que se estaba subiendo termina; el resto queda en la lista, con sus búsquedas listas, para cuando la retomes." } });
    this.syncLibrary();
  }

  private set(values: Partial<UploadState>) {
    this.state = { ...this.state, ...values };
    this.listeners.forEach((listener) => listener());
    if (this.pumpQueued) return;
    this.pumpQueued = true;
    queueMicrotask(() => {
      this.pumpQueued = false;
      this.pump();
    });
  }

  private update(change: (list: Upload[]) => Upload[]) {
    this.set({ queue: change(this.state.queue) });
  }

  /** After every change: asks for the reviews that are due and, while the upload runs, sends the next audio or ends it. */
  private pump() {
    const { phases, pendingReview } = this.progress();
    const phase = (item: Upload) => phases.get(item.key) as Phase;
    const { queue, auto } = this.state;
    this.askReview(pendingReview);
    const working = queue.some((item) => WORKING.has(phase(item)));
    this.guard(auto && working);
    if (!auto || this.busy) return;
    const next = queue.find((item) => phase(item) === "queued" || phase(item) === "checking");
    if (next && phase(next) === "queued") {
      void this.upload(next);
      return;
    }
    if (working) return;
    this.syncLibrary();
    if (!queue.some((item) => WAITING.has(phase(item)))) this.finish();
  }

  /**
   * Each song is compared with the library and with the songs before it once its data is settled, and again when it or
   * a song before it changes; one review at a time, a failed one is asked again. A result is kept only if the song is
   * still as it was asked and no song it could repeat reached the library meanwhile. It does not wait in a hidden tab,
   * where the browser slows timers down.
   */
  private askReview(pendingReview: string) {
    if (!pendingReview || this.asking || this.reviewTimer || this.retry) return;
    this.reviewTimer = window.setTimeout(() => void this.review(), document.hidden ? 0 : REVIEW_DELAY_MS);
  }

  private async review() {
    this.reviewTimer = 0;
    const list = this.state.queue;
    const asked = reviewContexts(list);
    const judge = list.filter((item) => needsReview(item, asked)).slice(0, REVIEW_CHUNK);
    if (!judge.length) return;
    const songs = list.slice(0, list.indexOf(judge[judge.length - 1]) + 1).filter((item) => inReview(item) && item.status !== "done");
    const from = this.uploadOrder.length;
    this.asking = true;
    const results = await reviewDuplicates(songs, judge.map((item) => item.key));
    this.asking = false;
    if (!results) {
      this.set({ reviewFailures: this.state.reviewFailures + 1 });
      this.retry = window.setTimeout(() => {
        this.retry = 0;
        this.pump();
      }, REVIEW_RETRY_MS);
      return;
    }
    const since = new Set(this.uploadOrder.slice(from));
    const judged = new Set(judge.map((item) => item.key));
    const now = this.state.queue;
    const contextsNow = reviewContexts(now);
    const lastUploaded = now.reduce((last, item, index) => (since.has(item.key) ? index : last), -1);
    this.set({
      reviewFailures: 0,
      queue: now.map((item, index) => {
        const context = asked.get(item.key);
        if (!judged.has(item.key) || item.status !== "ready" || !context || contextsNow.get(item.key) !== context) return item;
        const found = results[item.key] ?? [];
        if (index < lastUploaded || found.some((match) => match.batch && since.has(match.batch))) return item;
        return { ...item, duplicates: found, reviewedAs: context, decision: carry(item.decision, found, this.uploadedAs) };
      }),
    });
  }

  /**
   * While audios are going up: closing or reloading the panel asks first, and the browser is told not to freeze
   * the tab when it is in the background.
   */
  private guard(on: boolean) {
    if (on === this.guarding) return;
    this.guarding = on;
    if (on) {
      window.addEventListener("beforeunload", keepPage);
      if ("locks" in navigator) {
        navigator.locks.request(`zoe-radio-upload-${Date.now()}`, () => (this.guarding ? new Promise<void>((release) => (this.releaseLock = release)) : undefined)).catch(() => undefined);
      }
      return;
    }
    window.removeEventListener("beforeunload", keepPage);
    this.releaseLock?.();
    this.releaseLock = null;
  }

  /** Refreshes the library list with what was uploaded since the last time, if it is on screen (it loads fresh when opened again). */
  private syncLibrary() {
    if (!this.tally.unsynced) return;
    this.tally.unsynced = 0;
    if (this.state.viewing) router.reload({ only: ["tracks"] });
  }

  private async upload(item: Upload) {
    this.busy = true;
    this.patch(item.key, { status: "uploading", progress: 0, error: undefined });
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
    if (this.limits.canEpisodes && item.episode && !target) {
      data.set("episode", "1");
      data.set("episode_description", item.description);
      if (item.episodeCover) data.set("episode_cover", item.episodeCover);
    }
    const result = await postAudio(LIBRARY, data, item.file, item.kind, (progress) => this.patch(item.key, { progress }));
    this.busy = false;
    if (result.error) {
      this.patch(item.key, { status: "ready", progress: 0, error: result.error, blocked: true, reviewedAs: null });
      return;
    }
    this.uploadOrder.push(item.key);
    if (typeof result.id === "string") this.uploadedAs.set(item.key, result.id);
    const linked = new Set(batchMatches(item));
    if (target) this.tally.replaced++;
    else this.tally.uploaded++;
    this.tally.unsynced++;
    this.update((list) =>
      list.map((other) => {
        if (other.key === item.key) return { ...other, status: "done", progress: 1, replaced: target?.title ?? null };
        return other.reviewedAs && (linked.has(other.key) || batchMatches(other).includes(item.key)) ? { ...other, reviewedAs: null } : other;
      }),
    );
    if (this.tally.unsynced >= RELOAD_EVERY || !this.state.auto) this.syncLibrary();
  }

  /** Nothing is left to do on its own nor waits for the admin: the upload ends with its summary. */
  private finish() {
    const { phases } = this.progress();
    const { uploaded, replaced } = this.tally;
    this.tally = { uploaded: 0, replaced: 0, unsynced: 0 };
    const { queue } = this.state;
    const skipped = queue.filter((item) => phases.get(item.key) === "skip").length;
    const unreadable = queue.filter((item) => phases.get(item.key) === "unreadable").length;
    const finished = (item: Upload) => item.status === "done" || phases.get(item.key) === "skip";
    queue.filter(finished).forEach((item) => this.dropUrl(item.coverUrl));
    this.set({
      auto: false,
      queue: queue.filter((item) => !finished(item)),
      notice: {
        tone: unreadable ? "warn" : "ok",
        final: true,
        text:
          [
            uploaded ? `Listo: ${uploaded === 1 ? "se subió 1 audio" : `se subieron ${uploaded} audios`} a la biblioteca.` : "",
            replaced ? `${replaced === 1 ? "Se reemplazó el audio de 1 canción" : `Se reemplazó el audio de ${replaced} canciones`}, que conservan sus datos y su programación.` : "",
            skipped ? `${skipped === 1 ? "1 canción repetida no se subió" : `${skipped} canciones repetidas no se subieron`}, como elegiste.` : "",
            unreadable ? `${unreadable === 1 ? "1 archivo no se pudo leer y sigue" : `${unreadable} archivos no se pudieron leer y siguen`} en la lista.` : "",
            uploaded || replaced ? "Nada suena hasta que lo programes o lo lances desde la consola." : "",
          ]
            .filter(Boolean)
            .join(" ") || "No había audios para subir.",
      },
    });
  }
}

export const uploadQueue = new UploadQueue();

/** The upload as it is now; the component follows its changes. */
export function useUploadQueue() {
  return useSyncExternalStore(uploadQueue.subscribe, uploadQueue.snapshot, uploadQueue.snapshot);
}
