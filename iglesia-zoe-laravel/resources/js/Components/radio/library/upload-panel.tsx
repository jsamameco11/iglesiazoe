import { useEffect, useRef, useState, type DragEvent, type ReactNode } from "react";
import { button, ghost, input } from "@/Components/admin/ui";
import { AUDIO_ACCEPT, COVER_ACCEPT } from "@/Components/radio/admin-ui";
import { SearchIcon } from "@/Components/radio/icons";
import { duration, type RadioGenre } from "@/lib/radio";
import type { SongDetails } from "@/lib/radio/audio-tags";
import { DuplicateBadge, DuplicatePanel, LibraryTwin, concerns, duplicateShade, isPending, listenKey, type DuplicateChoice, type DuplicateDecision, type DuplicateMatch } from "./duplicates";
import { printOf } from "@/lib/radio/fingerprint";
import { CompareDialog, type ComparePair, type CompareSide } from "./compare-dialog";
import { CoAuthorsField, CoverPicker, GenrePicker, LookupBadge, MusicNote, cleanYear } from "./song-fields";
import { WORKING, duckFor, groupRepeats, isRepeat, missing, missingField, uploadQueue, useUploadQueue, type Kind, type Phase, type Upload } from "./upload-queue";

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

const small = `${input} !mt-0 !py-2`;

function sizeLabel(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

const plural = (count: number, one: string, many: string) => (count === 1 ? `1 ${one}` : `${count} ${many}`);

/**
 * Upload area of the library: drop or pick files, each song is recognized from its tags or its name and searched on the internet.
 * It shows the upload kept in `uploadQueue`, which goes on while the admin is in other sections or browser tabs.
 */
export function UploadPanel({ kinds, genres, families, maxGenres, maxFeatured, maxMb, maxDescription, canEpisodes, knownArtists }: Props) {
  const { queue, auto, notice } = useUploadQueue();
  const [uploadKind, setUploadKind] = useState<Kind>("musica");
  const [dragging, setDragging] = useState(false);
  const [previewing, setPreviewing] = useState<string | null>(null);
  const [bulk, setBulk] = useState<{ artist: string; album: string; genres: RadioGenre[]; year: string }>({ artist: "", album: "", genres: [], year: "" });
  const [flash, setFlash] = useState<string | null>(null);
  const [visited, setVisited] = useState<Record<string, number>>({});
  /** The repeated song open side by side with the ones it may repeat. */
  const [comparing, setComparing] = useState<string | null>(null);
  const picker = useRef<HTMLInputElement>(null);
  const depth = useRef(0);
  const player = useRef<HTMLAudioElement | null>(null);
  const flashTimer = useRef(0);

  const kindList = Object.keys(kinds) as Kind[];
  const { phases } = uploadQueue.progress();
  const phase = (item: Upload) => phases.get(item.key) as Phase;

  useEffect(() => uploadQueue.configure({ featured: maxFeatured, genres: maxGenres, canEpisodes }), [maxFeatured, maxGenres, canEpisodes]);
  useEffect(() => uploadQueue.view(), []);
  useEffect(
    () => () => {
      stopPreview();
      window.clearTimeout(flashTimer.current);
    },
    [],
  );

  const edit = (item: Upload, values: Partial<Upload>) => uploadQueue.edit(item.key, values);

  function addFiles(list: FileList | File[] | null) {
    uploadQueue.configure({ featured: maxFeatured, genres: maxGenres, canEpisodes });
    uploadQueue.addFiles(list, { kind: uploadKind, maxMb, knownArtists });
  }

  function remove(item: Upload) {
    if (previewing === item.key) stopPreview();
    uploadQueue.remove(item.key);
  }

  function clear() {
    stopPreview();
    uploadQueue.clear();
  }

  function stopPreview() {
    player.current?.pause();
    if (player.current?.src) uploadQueue.dropUrl(player.current.src);
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
    else play(item.key, uploadQueue.objectUrl(item.file));
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
    const other = queue.find((item) => item.key === match.batch);
    if (other) togglePreview(other);
  }

  function compare(key: string) {
    stopPreview();
    setComparing(key);
  }

  /** The same choice for every song that may repeat another, for long uploads. */
  function decideAll(choice: DuplicateChoice) {
    uploadQueue.decideAll(choice);
  }

  function applyToAll() {
    const values: Partial<Upload> = {};
    if (bulk.artist.trim()) values.artist = bulk.artist.trim();
    if (bulk.album.trim()) values.album = bulk.album.trim();
    if (bulk.genres.length) values.genres = bulk.genres;
    if (bulk.year) values.year = bulk.year;
    uploadQueue.applyToAll(values);
  }

  function start() {
    stopPreview();
    uploadQueue.start();
  }

  function pause() {
    uploadQueue.pause();
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

  /** Repeated songs in the order they are shown, to go through them side by side. */
  const comparable = ordered.filter(isRepeat);
  const compared = comparable.find((item) => item.key === comparing) ?? null;
  const sideOf = (item: Upload, place: string): CompareSide => ({
    key: item.key,
    place,
    title: item.title.trim() || item.file.name,
    credit: [item.artist.trim(), ...item.featured].filter(Boolean).join(", "),
    album: item.album.trim(),
    year: item.year,
    duration: item.duration,
    genres: item.genres.map((genre) => genre.name),
    cover: item.coverUrl,
    audio: item.file,
    bytes: item.file.size,
    fileName: item.file.name,
  });
  const pairsOf = (item: Upload): ComparePair[] =>
    concerns(item.duplicates).flatMap((match) => {
      if (match.track) {
        const track = match.track;
        return [{ match, other: { key: `track:${track.id}`, place: "En la biblioteca", title: track.title, credit: track.artist ?? "", album: track.album ?? "", year: track.year ? String(track.year) : "", duration: track.duration, genres: track.genres ?? [], cover: track.cover, audio: track.src, bytes: null, fileName: null } }];
      }
      const other = queue.find((entry) => entry.key === match.batch);
      return other ? [{ match, other: sideOf(other, "Otra de esta subida") }] : [];
    });
  const stepCompare = (from: Upload, direction: -1 | 1) => {
    const at = comparable.findIndex((item) => item.key === from.key);
    setComparing(comparable[(at + direction + comparable.length) % comparable.length].key);
  };
  /** Saves the choice and moves on to the next repeated song still waiting for one. */
  const chooseCompared = (item: Upload, decision: DuplicateDecision) => {
    edit(item, { decision });
    const at = comparable.findIndex((entry) => entry.key === item.key);
    const next = [...comparable.slice(at + 1), ...comparable.slice(0, at)].find((entry) => isPending(entry.duplicates, entry.decision));
    if (next) setComparing(next.key);
  };
  const upcoming = compared ? [...comparable.slice(comparable.indexOf(compared) + 1), ...comparable.slice(0, comparable.indexOf(compared))].find((item) => isPending(item.duplicates, item.decision)) : undefined;
  useEffect(() => {
    if (!upcoming) return;
    [upcoming.file, ...pairsOf(upcoming).map((pair) => pair.other.audio)].forEach((audio) => audio && printOf(audio).catch(() => null));
  }, [upcoming?.key]);

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
      onRetry={() => uploadQueue.patch(item.key, { blocked: false, error: undefined })}
      onLookUp={() => uploadQueue.lookUp(item.key, true)}
      onCover={(file) => uploadQueue.setCover(item.key, file)}
      onPreview={() => togglePreview(item)}
      onRemove={() => remove(item)}
      onCompare={() => compare(item.key)}
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
          {comparable.length ? (
            <button
              type="button"
              onClick={() => compare((verdicts.find(isRepeat) ?? comparable[0]).key)}
              className="rounded-full bg-ink px-3 py-1 text-[12px] font-semibold text-white shadow-sm transition hover:bg-ink/85"
              title="Abre cada repetida junto a la que ya tienes: datos campo por campo, ondas, escucha A/B y comparación del sonido."
            >
              ⇆ Compararlas lado a lado, una por una
            </button>
          ) : null}
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
          {group.some(isRepeat) ? (
            <button
              type="button"
              onClick={() => compare((group.find((item) => isRepeat(item) && isPending(item.duplicates, item.decision)) ?? group.find(isRepeat) ?? group[0]).key)}
              className="ml-auto rounded-full bg-white px-2.5 py-0.5 text-[11.5px] font-semibold text-ink shadow-sm ring-1 ring-line transition hover:bg-ink hover:text-white"
            >
              ⇆ Comparar lado a lado
            </button>
          ) : null}
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
                  ? "Cada audio se sube solo, uno por uno, apenas terminan su búsqueda en internet (álbum, año, estilos y carátula) y la revisión de repetidas. Sigue en segundo plano aunque vayas a otra sección del panel o cambies de pestaña; solo se detiene si cierras o recargas el panel."
                  : "Al guardar, cada audio se sube solo apenas terminen su búsqueda en internet (álbum, año, estilos y carátula) y la revisión de repetidas, también en segundo plano mientras usas otras secciones o pestañas; las que podrían estar repetidas esperan tu veredicto."}
            </p>
          </div>
        </div>
      )}
      {compared ? (
        <CompareDialog
          song={sideOf(compared, "La nueva")}
          pairs={pairsOf(compared)}
          review={compared.duplicates}
          decision={compared.decision}
          disabled={compared.status !== "ready"}
          position={{ index: comparable.indexOf(compared), total: comparable.length, pending: comparable.filter((item) => isPending(item.duplicates, item.decision)).length }}
          onStep={(direction) => stepCompare(compared, direction)}
          onChoose={(decision) => chooseCompared(compared, decision)}
          onSwap={() => edit(compared, { title: compared.artist, artist: compared.title })}
          onClose={() => setComparing(null)}
        />
      ) : null}
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
  onCompare,
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
  onCompare: () => void;
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
            <DuplicatePanel review={item.duplicates} decision={item.decision} disabled={locked} nameOf={nameOf} playing={playing} onListen={onListen} onChoose={(decision) => onPatch({ decision })} onCompare={onCompare} />
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
