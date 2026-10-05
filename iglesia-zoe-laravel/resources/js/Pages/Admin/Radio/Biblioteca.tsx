import { Link, router } from "@inertiajs/react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { AUDIO_ACCEPT, COVER_ACCEPT, KindTag, RadioHeader, postWithProgress, readDuration } from "@/Components/radio/admin-ui";
import { CoAuthorsField, CoverPicker, GenrePicker, LookupBadge, MusicNote, cleanYear, identifySong, identityJson, mergeNames, type LookupState } from "@/Components/radio/library/song-fields";
import { UploadPanel } from "@/Components/radio/library/upload-panel";
import { postAudio } from "@/Components/radio/audio-upload";
import { Notice, Stat, button, input, useAction } from "@/Components/admin/ui";
import AdminLayout from "@/Layouts/AdminLayout";
import { can, usePanelUser } from "@/lib/access";
import { send } from "@/lib/actions";
import { duration, longDuration, type RadioGenre, type RadioTrack } from "@/lib/radio";
import "../../../../css/radio.css";

type Kind = RadioTrack["kind"];

type Props = {
  tracks: RadioTrack[];
  kinds: Record<Kind, string>;
  genres: RadioGenre[];
  families: Record<string, string>;
  maxGenres: number;
  maxFeatured: number;
  maxMb: number;
  maxDescription: number;
};

const LIBRARY = "/admin/radio/biblioteca";

const upload = (data: FormData, onProgress?: (value: number) => void) => postWithProgress(LIBRARY, data, onProgress);

/** «Marcos Witt, Danilo Montero» */
function credit(track: RadioTrack) {
  return [track.artist, ...(track.featured ?? [])].filter(Boolean).join(", ");
}

/** «Pop rock alternativo / Pop progresivo» */
function styles(track: RadioTrack) {
  return (track.genres ?? []).map((genre) => genre.name).join(" / ");
}

export default function Biblioteca({ tracks, kinds, genres, families, maxGenres, maxFeatured, maxMb, maxDescription }: Props) {
  const canEpisodes = can(usePanelUser(), "radio.episodes");
  const [tab, setTab] = useState<Kind | "">("");
  const [genre, setGenre] = useState("");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);

  useEffect(() => () => audio.current?.pause(), []);

  const music = tracks.filter((track) => track.kind === "musica");
  const rotation = music.filter((track) => track.rotation && track.active);
  const knownArtists = music.flatMap((track) => [track.artist ?? "", ...(track.featured ?? [])]).filter(Boolean);
  const usedGenres = [...new Map(music.flatMap((track) => track.genres ?? []).map((value) => [value.id, value])).values()].sort((a, b) => a.name.localeCompare(b.name, "es"));
  const needle = query.trim().toLowerCase();
  const shown = tracks.filter(
    (track) =>
      (!tab || track.kind === tab) &&
      (!genre || (track.genres ?? []).some((value) => value.id === genre)) &&
      `${track.title} ${credit(track)} ${track.album ?? ""} ${styles(track)}`.toLowerCase().includes(needle),
  );
  const kindList = Object.keys(kinds) as Kind[];

  function togglePlay(track: RadioTrack) {
    audio.current ??= new Audio();
    if (playing === track.id) {
      audio.current.pause();
      setPlaying(null);
      return;
    }
    audio.current.src = track.src;
    audio.current.onended = () => setPlaying(null);
    void audio.current.play();
    setPlaying(track.id);
  }

  return (
    <AdminLayout>
      <RadioHeader
        title="Biblioteca de audio"
        text="Aquí guardas los recursos de la radio: canciones, anuncios grabados, efectos y cortinas, y programas pregrabados. Subir un audio no lo pone al aire: suena solo cuando lo programas o lo lanzas desde la consola. Una canción se repite en la música continua únicamente si activas «Se repite»."
      />

      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Audios en la biblioteca" value={tracks.length} note={music.length ? `${music.length} ${music.length === 1 ? "canción" : "canciones"}` : undefined} />
        <Stat
          label="En la música continua"
          value={rotation.length}
          note={rotation.length === 1 ? "Una sola canción: se repetirá sin parar" : rotation.length ? `${longDuration(rotation.reduce((sum, track) => sum + track.duration, 0))} antes de repetir` : "Ninguna se repite sola"}
          tone="bg-[#f4efe6]"
        />
        <Stat label="Anuncios y efectos" value={tracks.filter((track) => track.kind === "anuncio" || track.kind === "efecto").length} note="Elígelos para la botonera de la consola" />
        <Stat label="Programas grabados" value={tracks.filter((track) => track.kind === "programa").length} />
      </div>

      <UploadPanel
        kinds={kinds}
        genres={genres}
        families={families}
        maxGenres={maxGenres}
        maxFeatured={maxFeatured}
        maxMb={maxMb}
        maxDescription={maxDescription}
        canEpisodes={canEpisodes}
        knownArtists={knownArtists}
      />

      <section className="mt-6 rounded-[1.6rem] border border-line bg-card p-4 md:p-6">
        <div className="flex flex-wrap items-center gap-2">
          {(["", ...kindList] as const).map((kind) => (
            <button
              key={kind || "all"}
              type="button"
              onClick={() => setTab(kind)}
              className={`rounded-full px-4 py-2 text-xs font-semibold transition ${tab === kind ? "bg-ink text-white" : "bg-paper text-muted hover:text-ink"}`}
            >
              {kind ? kinds[kind] : "Todo"} · {kind ? tracks.filter((track) => track.kind === kind).length : tracks.length}
            </button>
          ))}
          <div className="ml-auto flex w-full flex-wrap gap-2 sm:w-auto">
            {usedGenres.length ? (
              <select value={genre} onChange={(event) => setGenre(event.target.value)} className={`${input} !mt-0 !w-auto`} aria-label="Filtrar por estilo musical">
                <option value="">Todos los estilos</option>
                {usedGenres.map((value) => (
                  <option key={value.id} value={value.id}>
                    {value.name}
                  </option>
                ))}
              </select>
            ) : null}
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nombre, autor, álbum o estilo…" className={`${input} !mt-0 min-w-0 flex-1 sm:!w-72`} />
          </div>
        </div>

        {shown.length === 0 ? (
          <p className="mt-5 rounded-[1.4rem] border border-dashed border-line px-5 py-10 text-center text-sm text-muted">
            {tracks.length === 0 ? "Aún no hay audios. Sube tus primeras canciones, anuncios y efectos arriba." : "No hay audios con ese filtro."}
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-line">
            {shown.map((track) => (
              <TrackRow
                key={track.id}
                track={track}
                kinds={kinds}
                genres={genres}
                families={families}
                maxGenres={maxGenres}
                maxFeatured={maxFeatured}
                maxMb={maxMb}
                canEpisodes={canEpisodes}
                playing={playing === track.id}
                editing={editing === track.id}
                onPlay={() => togglePlay(track)}
                onEdit={() => setEditing(editing === track.id ? null : track.id)}
              />
            ))}
          </ul>
        )}
      </section>
    </AdminLayout>
  );
}

function TrackRow({
  track,
  kinds,
  genres,
  families,
  maxGenres,
  maxFeatured,
  maxMb,
  canEpisodes,
  playing,
  editing,
  onPlay,
  onEdit,
}: {
  track: RadioTrack;
  kinds: Record<Kind, string>;
  genres: RadioGenre[];
  families: Record<string, string>;
  maxGenres: number;
  maxFeatured: number;
  maxMb: number;
  canEpisodes: boolean;
  playing: boolean;
  editing: boolean;
  onPlay: () => void;
  onEdit: () => void;
}) {
  const { result, setResult, pending, run } = useAction();
  const [kind, setKind] = useState<Kind>(track.kind);
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState<number | null>(null);
  const [fields, setFields] = useState({ title: track.title, artist: track.artist ?? "", album: track.album ?? "" });
  const [featured, setFeatured] = useState<string[]>(track.featured ?? []);
  const [year, setYear] = useState(track.year ? String(track.year) : "");
  const [chosen, setChosen] = useState<RadioGenre[]>(track.genres ?? []);
  const [cover, setCover] = useState<{ file: File | null; url: string | null; removed: boolean; remote: string | null }>({ file: null, url: track.cover ?? null, removed: false, remote: null });
  const [lookup, setLookup] = useState<LookupState | null>(null);
  const [identity, setIdentity] = useState<string | null>(null);
  const song = kind === "musica";
  const details = [credit(track), track.album ? `${track.album}${track.year ? ` (${track.year})` : ""}` : track.year ? String(track.year) : "", styles(track)].filter(Boolean);

  useEffect(() => {
    if (!editing) return;
    setKind(track.kind);
    setFields({ title: track.title, artist: track.artist ?? "", album: track.album ?? "" });
    setFeatured(track.featured ?? []);
    setYear(track.year ? String(track.year) : "");
    setChosen(track.genres ?? []);
    setCover({ file: null, url: track.cover ?? null, removed: false, remote: null });
    setLookup(null);
    setIdentity(null);
    setFile(null);
  }, [editing, track]);

  useEffect(() => () => void (cover.file && cover.url && URL.revokeObjectURL(cover.url)), [cover]);

  function pickCover(picked: File | null) {
    if (picked && (picked.size > 8 * 1024 * 1024 || !COVER_ACCEPT.split(",").includes(picked.type))) {
      setResult({ error: "La carátula debe ser una imagen JPG, PNG o WEBP de hasta 8 MB." });
      return;
    }
    setCover({ file: picked, url: picked ? URL.createObjectURL(picked) : null, removed: !picked, remote: null });
  }

  /** Asked on purpose: a sure answer replaces the album, year, styles and co-authors; a doubtful one only fills what is empty. */
  async function lookUp() {
    setLookup({ status: "searching" });
    const state = await identifySong({ id: track.id, title: fields.title, artist: fields.artist, featured });
    setLookup(state);
    if (state.status !== "found") return;
    const found = state.result;
    const sure = found.found && (found.confidence === "alta" || found.confidence === "media");
    if (found.found) {
      setFields((current) => ({
        title: sure && found.title ? found.title : current.title,
        artist: found.artist && (sure || !current.artist.trim()) ? found.artist : current.artist,
        album: found.album && (sure || !current.album.trim()) ? found.album : current.album,
      }));
      if (found.year && (sure || !year)) setYear(String(found.year));
      const main = (found.artist ?? fields.artist).toLowerCase();
      setFeatured((current) => mergeNames(current.filter((name) => name.toLowerCase() !== main), found.featured, maxFeatured));
      if (found.cover_url && !cover.file && (!cover.url || cover.removed || cover.remote)) setCover({ file: null, url: found.cover_url, removed: false, remote: found.cover_url });
      setIdentity(identityJson(found));
    }
    if (found.genres.length && (sure || chosen.length === 0)) setChosen(found.genres.slice(0, maxGenres));
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    data.set("id", track.id);
    data.set("active", data.get("active") ? "1" : "0");
    data.set("duck", data.get("duck") ? "1" : "0");
    data.set("year", year);
    data.delete("audio");
    if (cover.file) data.set("cover", cover.file);
    else if (cover.remote) data.set("cover_url", cover.remote);
    else if (cover.removed) data.set("remove_cover", "1");
    if (identity) data.set("identity", identity);
    if (file) {
      if (file.size > maxMb * 1024 * 1024) {
        setResult({ error: `El audio pesa más de ${maxMb} MB.` });
        return;
      }
      const seconds = await readDuration(file);
      if (!seconds) {
        setResult({ error: "No pudimos leer este audio. Prueba con MP3 o M4A." });
        return;
      }
      data.set("duration", String(seconds));
    }
    const audio = file;
    run(
      () =>
        (audio ? postAudio(LIBRARY, data, audio, String(data.get("kind") || track.kind), setSending) : upload(data)).then((response) => {
          setSending(null);
          if (response.reload) router.reload({ only: ["tracks"] });
          return response;
        }),
      onEdit,
    );
  }

  function toggleRotation() {
    run(() => send("/admin/radio/biblioteca/rotacion", { id: track.id, on: track.rotation ? "0" : "1" }));
  }

  function remove() {
    const extra = `${track.upcoming ? ` También se quitará de ${track.upcoming} bloque(s) programados.` : ""}${track.episodes ? " Su episodio dejará de verse en la página de la radio." : ""}`;
    if (!window.confirm(`¿Eliminar «${track.title}» de la biblioteca?${extra}`)) return;
    run(() => send("/admin/radio/biblioteca/eliminar", { id: track.id }));
  }

  return (
    <li className="py-3">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onPlay}
          className="group relative grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-paper text-ink transition"
          aria-label={playing ? "Detener" : "Escuchar"}
        >
          {track.cover ? <img src={track.cover} alt="" className="absolute inset-0 h-full w-full object-cover" /> : track.kind === "musica" ? <MusicNote className="h-5 w-5 text-muted" /> : null}
          <span
            className={`absolute inset-0 grid place-items-center text-sm transition ${playing ? "bg-ink/75 text-white" : track.cover || track.kind === "musica" ? "bg-ink/0 text-transparent group-hover:bg-ink/60 group-hover:text-white" : "group-hover:bg-ink group-hover:text-white"}`}
          >
            {playing ? "■" : "▶"}
          </span>
        </button>
        <div className="min-w-0 flex-1">
          <p className={`truncate text-[15px] font-semibold ${track.active ? "" : "text-muted line-through"}`}>{track.title}</p>
          <p className="truncate text-[12.5px] text-muted">
            {details.length ? `${details.join(" · ")} · ` : ""}
            {duration(track.duration)}
            {track.upcoming ? ` · en ${track.upcoming} bloque(s) programado(s)` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <KindTag kind={track.kind} label={kinds[track.kind]} />
          {track.kind === "musica" ? (
            <button
              type="button"
              role="switch"
              aria-checked={track.rotation}
              disabled={pending || (!track.active && !track.rotation)}
              onClick={toggleRotation}
              title={track.rotation ? "Se repite en los espacios libres de la programación. Clic para que no se repita." : "Solo suena cuando lo programas o lo lanzas. Clic para que se repita en la música continua."}
              className={`inline-flex items-center gap-2 rounded-full py-1 pl-1 pr-2.5 text-[11px] font-semibold transition disabled:opacity-50 ${track.rotation ? "bg-emerald-50 text-emerald-800 hover:bg-emerald-100" : "bg-paper text-muted hover:text-ink"}`}
            >
              <span className={`relative h-4 w-7 rounded-full transition-colors ${track.rotation ? "bg-emerald-600" : "bg-line"}`}>
                <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow-sm transition-[left] ${track.rotation ? "left-3.5" : "left-0.5"}`} />
              </span>
              {track.rotation ? "Se repite" : "No se repite"}
            </button>
          ) : null}
          {track.duck ? <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800">Baja la música</span> : null}
          {!track.active ? <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800">Desactivado</span> : null}
          {track.problem ? (
            <span
              className="rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-800"
              title="La radio lo dejó de usar y siguió con otra canción. Vuelve a subir el archivo para que regrese al aire."
            >
              {track.problem === "unplayable" ? "No se pudo reproducir" : "Archivo dañado o perdido"}
            </span>
          ) : null}
          {track.episodes ? (
            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-800">Episodio publicado</span>
          ) : canEpisodes ? (
            <Link href={`/admin/radio/episodios?audio=${track.id}`} className="rounded-full px-3 py-1.5 text-xs font-semibold text-blue-800 transition hover:bg-blue-50">
              Guardar como episodio
            </Link>
          ) : null}
          <button type="button" onClick={onEdit} className="rounded-full px-3 py-1.5 text-xs font-semibold text-muted transition hover:bg-paper hover:text-ink">
            {editing ? "Cerrar" : "Editar"}
          </button>
          <button type="button" disabled={pending} onClick={remove} className="rounded-full px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-50">
            Eliminar
          </button>
        </div>
      </div>
      {editing ? (
        <form onSubmit={save} className="mt-3 flex gap-4 rounded-2xl border border-line bg-white p-4">
          {song ? <CoverPicker src={cover.url} onPick={pickCover} onRemove={() => pickCover(null)} size="h-24 w-24" /> : null}
          <div className="grid min-w-0 flex-1 gap-3 md:grid-cols-2">
            {song ? (
              <div className="flex flex-wrap items-center gap-2 text-[11.5px] md:col-span-2">
                <button
                  type="button"
                  disabled={lookup?.status === "searching" || fields.title.trim().length < 2}
                  onClick={lookUp}
                  className="rounded-full bg-paper px-3 py-1.5 text-xs font-semibold text-ink transition hover:bg-ink hover:text-white disabled:opacity-50"
                  title="Busca la canción en internet (Apple Music, Deezer, MusicBrainz y Wikidata) con el nombre y el autor de abajo, y completa autor, coautores, álbum, año, estilos y carátula."
                >
                  ⌕ Buscar datos en internet
                </button>
                <LookupBadge state={lookup} />
                {lookup?.status === "error" ? <span className="text-red-700">{lookup.error}</span> : null}
              </div>
            ) : null}
            <label className="text-xs font-semibold text-muted">
              {song ? "Nombre de la canción" : "Nombre"} <span className="text-red-600">*</span>
              <input name="title" value={fields.title} onChange={(event) => setFields({ ...fields, title: event.target.value })} required maxLength={160} className={input} />
            </label>
            <label className="text-xs font-semibold text-muted">
              {song ? (
                <>
                  Autor <span className="text-red-600">*</span>
                </>
              ) : kind === "programa" ? (
                "Programa o locutor (opcional)"
              ) : (
                "Autor (opcional)"
              )}
              <input name="artist" value={fields.artist} onChange={(event) => setFields({ ...fields, artist: event.target.value })} required={song} maxLength={120} className={input} />
            </label>
            {song ? (
              <>
                <div className="md:col-span-2">
                  <CoAuthorsField value={featured} onChange={setFeatured} max={maxFeatured} name="featured" />
                </div>
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_6rem] md:col-span-2">
                  <label className="text-xs font-semibold text-muted">
                    Álbum <span className="font-normal">(opcional)</span>
                    <input name="album" value={fields.album} onChange={(event) => setFields({ ...fields, album: event.target.value })} maxLength={160} className={input} />
                  </label>
                  <label className="text-xs font-semibold text-muted">
                    Año
                    <input value={year} onChange={(event) => setYear(cleanYear(event.target.value))} inputMode="numeric" placeholder="2024" className={input} />
                  </label>
                </div>
                <div className="md:col-span-2">
                  <span className="text-xs font-semibold text-muted">
                    Estilos musicales <span className="font-normal">(hasta {maxGenres}; el primero es el principal)</span>
                  </span>
                  <div className="mt-1.5">
                    <GenrePicker value={chosen} onChange={setChosen} genres={genres} families={families} max={maxGenres} name="genre_ids" />
                  </div>
                </div>
              </>
            ) : null}
            <label className="text-xs font-semibold text-muted">
              Tipo
              <select name="kind" value={kind} onChange={(event) => setKind(event.target.value as Kind)} className={input}>
                {(Object.keys(kinds) as Kind[]).map((value) => (
                  <option key={value} value={value}>
                    {kinds[value]}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-semibold text-muted">
              Reemplazar archivo (opcional)
              <input
                type="file"
                name="audio"
                accept={AUDIO_ACCEPT}
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                className={`${input} file:mr-3 file:rounded-full file:border-0 file:bg-paper file:px-3 file:py-1 file:text-xs file:font-semibold`}
              />
            </label>
            <div className="flex flex-wrap gap-5 md:col-span-2">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="duck" value="1" defaultChecked={track.duck} /> Bajar la música cuando suene encima
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="active" value="1" defaultChecked={track.active} /> Activo
              </label>
            </div>
            <div className="md:col-span-2">
              <Notice result={result} onClose={() => setResult(null)} />
              <button disabled={pending} className={`${button} mt-2`}>
                {pending ? (sending !== null && sending < 1 ? `Subiendo audio… ${Math.round(sending * 100)}%` : "Guardando…") : "Guardar cambios"}
              </button>
            </div>
          </div>
        </form>
      ) : result?.error ? (
        <div className="mt-2">
          <Notice result={result} onClose={() => setResult(null)} />
        </div>
      ) : null}
    </li>
  );
}
