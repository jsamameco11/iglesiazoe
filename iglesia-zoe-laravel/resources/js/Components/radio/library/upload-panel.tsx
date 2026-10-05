import { router } from "@inertiajs/react";
import { useEffect, useRef, useState, type DragEvent } from "react";
import { button, ghost, input } from "@/Components/admin/ui";
import { AUDIO_ACCEPT, COVER_ACCEPT, readDuration } from "@/Components/radio/admin-ui";
import { postAudio } from "@/Components/radio/audio-upload";
import { duration, type RadioGenre, type RadioTrack } from "@/lib/radio";
import { artistHints, parseFileName, recognizeSong, type SongDetails } from "@/lib/radio/audio-tags";
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
  /** Also publish it on /radio as an episode, with this description and cover. */
  episode: boolean;
  description: string;
  episodeCover: File | null;
};

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

/** Spoken audio lowers the music by default when it plays on top of it. */
const duckFor = (kind: Kind) => kind === "anuncio" || kind === "programa";

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
  }
  const sameGenres = current.genres.map((genre) => genre.id).join() === base.genres.map((genre) => genre.id).join();
  if (result.genres.length && sameGenres && (force || current.genres.length === 0)) next.genres = result.genres.slice(0, limits.genres);
  return next;
}

/** Upload area of the library: drop or pick files, each song is recognized from its tags or its name and completed before uploading. */
export function UploadPanel({ kinds, genres, families, maxGenres, maxFeatured, maxMb, maxDescription, canEpisodes, knownArtists }: Props) {
  const [queue, setQueue] = useState<Upload[]>([]);
  const [uploadKind, setUploadKind] = useState<Kind>("musica");
  const [running, setRunning] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [notice, setNotice] = useState<{ tone: "ok" | "warn"; text: string } | null>(null);
  const [previewing, setPreviewing] = useState<string | null>(null);
  const [bulk, setBulk] = useState<{ artist: string; album: string; genres: RadioGenre[]; year: string }>({ artist: "", album: "", genres: [], year: "" });
  const picker = useRef<HTMLInputElement>(null);
  const depth = useRef(0);
  const player = useRef<HTMLAudioElement | null>(null);
  const urls = useRef(new Set<string>());
  const current = useRef(queue);
  const lookups = useRef<Promise<void>>(Promise.resolve());
  current.current = queue;

  const kindList = Object.keys(kinds) as Kind[];

  useEffect(
    () => () => {
      player.current?.pause();
      urls.current.forEach((url) => URL.revokeObjectURL(url));
    },
    [],
  );

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

  /** One song at a time, so the music services are asked politely; each one reads the song as it is when its turn comes. */
  function lookUp(key: string, force = false) {
    patch(key, { lookup: { status: "searching" } });
    lookups.current = lookups.current.then(async () => {
      const base = current.current.find((item) => item.key === key);
      if (!base || base.kind !== "musica" || base.status !== "ready" || base.title.trim().length < 2) {
        patch(key, { lookup: null });
        return;
      }
      const state = await identifySong({ title: base.title, artist: base.artist, featured: base.featured, duration: base.duration, genre: base.tagGenre });
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
  }

  function setCover(item: Upload, file: File | null) {
    if (file && (file.size > MAX_COVER_BYTES || !COVER_ACCEPT.split(",").includes(file.type))) {
      setNotice({ tone: "warn", text: "La carátula debe ser una imagen JPG, PNG o WEBP de hasta 8 MB." });
      return;
    }
    dropUrl(item.coverUrl);
    patch(item.key, { cover: file, coverUrl: file ? objectUrl(file) : null, remoteCover: null });
  }

  function stopPreview() {
    player.current?.pause();
    if (player.current?.src) dropUrl(player.current.src);
    setPreviewing(null);
  }

  function togglePreview(item: Upload) {
    if (previewing === item.key) {
      stopPreview();
      return;
    }
    stopPreview();
    player.current ??= new Audio();
    player.current.src = objectUrl(item.file);
    player.current.onended = stopPreview;
    void player.current.play();
    setPreviewing(item.key);
  }

  function applyToAll() {
    const values: Partial<Upload> = {};
    if (bulk.artist.trim()) values.artist = bulk.artist.trim();
    if (bulk.album.trim()) values.album = bulk.album.trim();
    if (bulk.genres.length) values.genres = bulk.genres;
    if (bulk.year) values.year = bulk.year;
    setQueue((list) => list.map((item) => (item.kind === "musica" && (item.status === "ready" || item.status === "error") ? { ...item, ...values } : item)));
  }

  async function uploadAll() {
    stopPreview();
    setRunning(true);
    setNotice(null);
    let uploaded = 0;
    for (const item of queue) {
      if (item.status !== "ready" || !item.duration || missing(item)) continue;
      patch(item.key, { status: "uploading", progress: 0, error: undefined });
      const data = new FormData();
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
      }
      if (canEpisodes && item.episode) {
        data.set("episode", "1");
        data.set("episode_description", item.description);
        if (item.episodeCover) data.set("episode_cover", item.episodeCover);
      }
      const result = await postAudio(LIBRARY, data, item.file, item.kind, (progress) => patch(item.key, { progress }));
      if (result.error) patch(item.key, { status: "ready", progress: 0, error: result.error });
      else {
        patch(item.key, { status: "done", progress: 1 });
        uploaded++;
      }
    }
    setRunning(false);
    if (uploaded) {
      router.reload({ only: ["tracks"] });
      setQueue((list) => {
        list.filter((item) => item.status === "done").forEach((item) => dropUrl(item.coverUrl));
        return list.filter((item) => item.status !== "done");
      });
      setNotice({ tone: "ok", text: `${uploaded === 1 ? "Se subió 1 audio" : `Se subieron ${uploaded} audios`} a la Biblioteca. Nada suena hasta que lo programes o lo lances desde la consola.` });
    }
  }

  function onDrag(event: DragEvent, entering: boolean | null) {
    if (!Array.from(event.dataTransfer.types).includes("Files")) return;
    event.preventDefault();
    if (entering === true) depth.current++;
    if (entering === false) depth.current = Math.max(0, depth.current - 1);
    setDragging(depth.current > 0);
  }

  const reading = queue.filter((item) => item.status === "reading").length;
  const searching = queue.filter((item) => item.lookup?.status === "searching").length;
  const ready = queue.filter((item) => item.status === "ready" && !missing(item) && item.lookup?.status !== "searching");
  const incomplete = queue.filter((item) => item.status === "ready" && missing(item)).length;
  const songs = queue.filter((item) => item.kind === "musica" && item.status !== "done");

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
                <button type="button" disabled={running || !(bulk.artist.trim() || bulk.album.trim() || bulk.genres.length || bulk.year)} onClick={applyToAll} className={`${ghost} !py-2`}>
                  Aplicar a todas
                </button>
              </div>
              <div className="mt-2">
                <GenrePicker value={bulk.genres} onChange={(value) => setBulk({ ...bulk, genres: value })} genres={genres} families={families} max={maxGenres} />
              </div>
            </div>
          ) : null}

          {queue.map((item) => (
            <UploadCard
              key={item.key}
              item={item}
              kinds={kinds}
              kindList={kindList}
              genres={genres}
              families={families}
              maxGenres={maxGenres}
              maxFeatured={maxFeatured}
              maxDescription={maxDescription}
              canEpisodes={canEpisodes}
              running={running}
              previewing={previewing === item.key}
              onPatch={(values) => patch(item.key, values)}
              onLookUp={() => lookUp(item.key, true)}
              onCover={(file) => setCover(item, file)}
              onPreview={() => togglePreview(item)}
              onRemove={() => remove(item)}
            />
          ))}

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button type="button" disabled={running || ready.length === 0} onClick={uploadAll} className={button}>
              {running ? "Subiendo…" : `Subir ${ready.length} audio${ready.length === 1 ? "" : "s"}`}
            </button>
            <button type="button" disabled={running} onClick={clear} className={ghost}>
              Limpiar lista
            </button>
            <p className="text-[12.5px] text-muted">
              {reading ? `Reconociendo ${reading} ${reading === 1 ? "audio" : "audios"}… ` : ""}
              {searching ? `Buscando ${searching === 1 ? "1 canción" : `${searching} canciones`} en internet… ` : ""}
              {incomplete ? <span className="font-medium text-amber-800">Completa los datos obligatorios en {incomplete === 1 ? "1 audio" : `${incomplete} audios`} para subirlos.</span> : null}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

const SOURCE: Record<SongDetails["source"], { text: string; tone: string; hint: string }> = {
  tags: { text: "✓ Reconocida del archivo", tone: "bg-emerald-50 text-emerald-800", hint: "Los datos vienen de las etiquetas del archivo. Revísalos si quieres." },
  name: { text: "Tomada del nombre del archivo", tone: "bg-amber-50 text-amber-800", hint: "El archivo no traía etiquetas: el nombre y el autor salen del nombre del archivo. Revísalos." },
  none: { text: "Sin datos en el archivo", tone: "bg-slate-100 text-slate-700", hint: "No encontramos el nombre ni el autor: complétalos." },
};

function UploadCard({
  item,
  kinds,
  kindList,
  genres,
  families,
  maxGenres,
  maxFeatured,
  maxDescription,
  canEpisodes,
  running,
  previewing,
  onPatch,
  onLookUp,
  onCover,
  onPreview,
  onRemove,
}: {
  item: Upload;
  kinds: Record<Kind, string>;
  kindList: Kind[];
  genres: RadioGenre[];
  families: Record<string, string>;
  maxGenres: number;
  maxFeatured: number;
  maxDescription: number;
  canEpisodes: boolean;
  running: boolean;
  previewing: boolean;
  onPatch: (values: Partial<Upload>) => void;
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

  return (
    <article className={`rounded-2xl border bg-white p-3 transition md:p-4 ${item.error ? "border-red-200" : problem ? "border-amber-200" : "border-line"}`}>
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
            <span className="ml-auto flex items-center gap-1">
              {song && !locked && !searching && item.title.trim().length >= 2 ? (
                <button
                  type="button"
                  disabled={running}
                  onClick={onLookUp}
                  className="rounded-full bg-paper px-2.5 py-1 text-[11px] font-semibold text-ink transition hover:bg-ink hover:text-white"
                  title="Vuelve a buscar la canción en internet con el nombre y el autor de ahora, y reemplaza el álbum, el año, los estilos y la carátula encontrados."
                >
                  ⌕ Buscar en internet
                </button>
              ) : null}
              {song && !locked && (item.title.trim() || item.artist.trim()) ? (
                <button
                  type="button"
                  disabled={running}
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
                <button type="button" disabled={running} onClick={onRemove} className="px-1.5 text-lg leading-none text-muted hover:text-red-700" aria-label="Quitar de la lista">
                  ×
                </button>
              )}
            </span>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-xs font-semibold text-muted">
              {song ? "Nombre de la canción" : "Nombre"} {required}
              <input
                value={item.title}
                disabled={locked}
                onChange={(event) => onPatch({ title: event.target.value })}
                placeholder={song ? "Ej.: Renuévame" : "Ej.: Retiro de jóvenes"}
                maxLength={160}
                className={`${small} mt-1.5 ${titleMissing ? "!border-red-300" : ""}`}
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
                value={item.artist}
                disabled={locked}
                onChange={(event) => onPatch({ artist: event.target.value })}
                placeholder={song ? "Ej.: Marcos Witt" : ""}
                maxLength={120}
                className={`${small} mt-1.5 ${artistMissing ? "!border-red-300" : ""}`}
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
                  <input value={item.year} disabled={locked} onChange={(event) => onPatch({ year: cleanYear(event.target.value) })} placeholder="2024" inputMode="numeric" className={`${small} mt-1.5`} />
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
          {item.error ? <p className="text-xs font-medium text-red-700">{item.error}</p> : null}
          {problem ? <p className="text-xs font-medium text-amber-800">{problem}</p> : null}
        </div>
      </div>
    </article>
  );
}
