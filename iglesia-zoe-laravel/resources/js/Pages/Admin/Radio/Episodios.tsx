import { router } from "@inertiajs/react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { AUDIO_ACCEPT, COVER_ACCEPT, RadioHeader, postWithProgress, readDuration } from "@/Components/radio/admin-ui";
import { postAudio } from "@/Components/radio/audio-upload";
import { EpisodeCover } from "@/Components/radio/episode-cover";
import { Notice, Stat, button, ghost, input, useAction } from "@/Components/admin/ui";
import AdminLayout from "@/Layouts/AdminLayout";
import { send, type ActionResult } from "@/lib/actions";
import { duration, longDate, type RadioEpisodeAdmin, type RadioTrack } from "@/lib/radio";
import "../../../../css/radio.css";

type Kind = RadioTrack["kind"];

const EPISODES = "/admin/radio/episodios";

type Props = {
  episodes: RadioEpisodeAdmin[];
  tracks: RadioTrack[];
  kinds: Record<Kind, string>;
  prefill: string | null;
  today: string;
  maxMb: number;
  maxDescription: number;
};

type FormProps = Omit<Props, "episodes" | "prefill"> & {
  episode?: RadioEpisodeAdmin;
  trackId?: string;
  programs: string[];
  onDone: () => void;
};

export default function Episodios({ episodes, tracks, kinds, prefill, today, maxMb, maxDescription }: Props) {
  const [creating, setCreating] = useState(Boolean(prefill));
  const [editing, setEditing] = useState<string | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);

  useEffect(() => () => audio.current?.pause(), []);

  const programs = [...new Set(episodes.map((episode) => episode.program).filter((name): name is string => Boolean(name)))].sort();
  const published = episodes.filter((episode) => episode.published).length;
  const formProps = { tracks, kinds, today, maxMb, maxDescription, programs };

  function togglePlay(episode: RadioEpisodeAdmin) {
    audio.current ??= new Audio();
    if (playing === episode.id || !episode.src) {
      audio.current.pause();
      setPlaying(null);
      return;
    }
    audio.current.src = episode.src;
    audio.current.onended = () => setPlaying(null);
    void audio.current.play();
    setPlaying(episode.id);
  }

  return (
    <AdminLayout>
      <RadioHeader
        title="Episodios"
        text="Los programas grabados que la gente puede escuchar cuando quiera en la página de la radio, con su carátula, título y una descripción corta. El audio sale de la biblioteca: elige uno que ya subiste o sube uno nuevo aquí."
        aside={
          <button type="button" onClick={() => setCreating((open) => !open)} className={button}>
            {creating ? "Cerrar" : "+ Nuevo episodio"}
          </button>
        }
      />

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <Stat label="Publicados en la página" value={published} tone="bg-[#e9f1ff]" />
        <Stat label="Ocultos" value={episodes.length - published} note="Guardados, pero no se ven en la página" />
        <Stat label="Programas" value={programs.length} note={programs.slice(0, 3).join(" · ") || "Ponle nombre del programa a cada episodio"} />
      </div>

      {creating ? (
        <section className="mt-6 rounded-[1.6rem] border border-line bg-card p-5 md:p-6">
          <h2 className="text-lg font-semibold tracking-[-0.025em]">Nuevo episodio</h2>
          <p className="mt-1 text-[13px] leading-5 text-muted">Se publica en la sección «Episodios» de la página de la radio. Desmarca «Publicado» si aún no quieres que se vea.</p>
          <EpisodeForm {...formProps} trackId={prefill ?? undefined} onDone={() => setCreating(false)} />
        </section>
      ) : null}

      <section className="mt-6 rounded-[1.6rem] border border-line bg-card p-4 md:p-6">
        {episodes.length === 0 ? (
          <div className="rounded-[1.4rem] border border-dashed border-line px-5 py-12 text-center">
            <p className="text-sm font-semibold">Aún no hay episodios.</p>
            <p className="mx-auto mt-1 max-w-md text-[13px] leading-5 text-muted">Crea el primero con «+ Nuevo episodio», o en la Biblioteca marca «Publicar también como episodio» al subir un programa grabado.</p>
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {episodes.map((episode) => (
              <EpisodeRow
                key={episode.id}
                episode={episode}
                playing={playing === episode.id}
                editing={editing === episode.id}
                onPlay={() => togglePlay(episode)}
                onEdit={() => setEditing(editing === episode.id ? null : episode.id)}
                form={<EpisodeForm {...formProps} episode={episode} onDone={() => setEditing(null)} />}
              />
            ))}
          </ul>
        )}
      </section>
    </AdminLayout>
  );
}

function EpisodeRow({
  episode,
  playing,
  editing,
  onPlay,
  onEdit,
  form,
}: {
  episode: RadioEpisodeAdmin;
  playing: boolean;
  editing: boolean;
  onPlay: () => void;
  onEdit: () => void;
  form: React.ReactNode;
}) {
  const { result, setResult, pending, run } = useAction();

  function remove() {
    if (!window.confirm(`¿Quitar «${episode.title}» de los episodios? El audio seguirá en la biblioteca.`)) return;
    run(() => send("/admin/radio/episodios/eliminar", { id: episode.id }));
  }

  return (
    <li className="py-4">
      <div className="flex flex-wrap items-start gap-4">
        <EpisodeCover src={episode.cover} title={episode.title} className="h-16 w-16 rounded-xl" />
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold leading-snug">{episode.title}</p>
          <p className="mt-0.5 text-[12.5px] text-muted">
            {episode.program ? `${episode.program} · ` : ""}
            {longDate(episode.aired_on)} · {duration(episode.duration)}
          </p>
          {episode.description ? <p className="mt-1.5 line-clamp-2 max-w-2xl text-[13px] leading-5 text-ink/80">{episode.description}</p> : <p className="mt-1.5 text-[12.5px] italic text-muted">Sin descripción</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {episode.published ? (
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800">Publicado</span>
          ) : (
            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800">Oculto</span>
          )}
          <button type="button" onClick={onPlay} disabled={!episode.src} className="rounded-full px-3 py-1.5 text-xs font-semibold text-muted transition hover:bg-paper hover:text-ink">
            {playing ? "■ Detener" : "▶ Escuchar"}
          </button>
          <button type="button" onClick={onEdit} className="rounded-full px-3 py-1.5 text-xs font-semibold text-muted transition hover:bg-paper hover:text-ink">{editing ? "Cerrar" : "Editar"}</button>
          <button type="button" disabled={pending} onClick={remove} className="rounded-full px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-50">Quitar</button>
        </div>
      </div>
      {editing ? <div className="mt-4 rounded-2xl border border-line bg-white p-4 md:p-5">{form}</div> : null}
      {result?.error ? (
        <div className="mt-2">
          <Notice result={result} onClose={() => setResult(null)} />
        </div>
      ) : null}
    </li>
  );
}

function EpisodeForm({ episode, trackId, tracks, kinds, programs, today, maxMb, maxDescription, onDone }: FormProps) {
  const initialTrack = tracks.find((track) => track.id === (episode?.track_id ?? trackId));
  const [source, setSource] = useState<"library" | "upload">(tracks.length || episode ? "library" : "upload");
  const [track, setTrack] = useState(episode?.track_id ?? initialTrack?.id ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState(episode?.title ?? initialTrack?.title ?? "");
  const [program, setProgram] = useState(episode?.program ?? initialTrack?.artist ?? "");
  const [description, setDescription] = useState(episode?.description ?? "");
  const [cover, setCover] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(episode?.cover ?? null);
  const [removeCover, setRemoveCover] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [result, setResult] = useState<ActionResult | null>(null);
  const picker = useRef<HTMLInputElement>(null);
  const kindOrder = Object.keys(kinds) as Kind[];
  const listId = `programas-${episode?.id ?? "nuevo"}`;

  useEffect(() => {
    if (!cover) return;
    const url = URL.createObjectURL(cover);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [cover]);

  function chooseTrack(id: string) {
    setTrack(id);
    const chosen = tracks.find((item) => item.id === id);
    if (chosen && !title.trim()) setTitle(chosen.title);
    if (chosen?.artist && !program.trim()) setProgram(chosen.artist);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    if (episode) data.set("id", episode.id);
    data.set("published", data.get("published") ? "1" : "0");
    data.delete("audio");
    data.delete("cover");
    if (cover) data.set("cover", cover);
    if (removeCover) data.set("remove_cover", "1");
    if (source === "upload") {
      if (!file) return setResult({ error: "Elige el archivo de audio del episodio." });
      if (file.size > maxMb * 1024 * 1024) return setResult({ error: `El audio pesa más de ${maxMb} MB. Expórtalo en MP3 (128–192 kbps).` });
      const seconds = await readDuration(file);
      if (!seconds) return setResult({ error: "No pudimos leer este audio. Prueba con MP3 o M4A." });
      data.set("duration", String(seconds));
      data.delete("track_id");
    }
    setResult(null);
    setProgress(0);
    const response = source === "upload" && file ? await postAudio(EPISODES, data, file, "programa", setProgress) : await postWithProgress(EPISODES, data, setProgress);
    setProgress(null);
    setResult(response);
    if (!response.error) {
      router.reload({ only: ["episodes", "tracks"] });
      onDone();
    }
  }

  const busy = progress !== null;

  return (
    <form onSubmit={save} className="mt-5 grid gap-5 md:grid-cols-[11rem_minmax(0,1fr)]">
      <div>
        <button type="button" onClick={() => picker.current?.click()} className="group relative block w-full overflow-hidden rounded-2xl" aria-label="Elegir carátula">
          <EpisodeCover src={removeCover ? null : preview} title={title || "Episodio"} className="aspect-square w-full rounded-2xl" />
          <span className="absolute inset-x-2 bottom-2 rounded-full bg-black/60 px-3 py-1.5 text-center text-[11px] font-semibold text-white opacity-0 transition group-hover:opacity-100">Cambiar carátula</span>
        </button>
        <input
          ref={picker}
          type="file"
          accept={COVER_ACCEPT}
          hidden
          onChange={(event) => {
            setCover(event.target.files?.[0] ?? null);
            setRemoveCover(false);
            event.target.value = "";
          }}
        />
        <p className="mt-2 text-[11px] leading-4 text-muted">Imagen cuadrada JPG, PNG o WEBP · hasta 8 MB. Si no subes una, se muestra una carátula con las iniciales.</p>
        {(preview || cover) && !removeCover ? (
          <button
            type="button"
            onClick={() => {
              setCover(null);
              setRemoveCover(true);
            }}
            className="mt-1 text-[11px] font-semibold text-red-700"
          >
            Quitar carátula
          </button>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <fieldset className="md:col-span-2">
          <legend className="text-xs font-semibold text-muted">Audio del episodio</legend>
          <div className="mt-1.5 inline-flex rounded-full border border-line bg-white p-1">
            {(["library", "upload"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setSource(value)}
                className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${source === value ? "bg-ink text-white" : "text-muted hover:text-ink"}`}
              >
                {value === "library" ? "De la biblioteca" : "Subir audio nuevo"}
              </button>
            ))}
          </div>
          {source === "library" ? (
            <select name="track_id" value={track} onChange={(event) => chooseTrack(event.target.value)} required className={input}>
              <option value="">Elige un audio…</option>
              {kindOrder.map((kind) => {
                const options = tracks.filter((item) => item.kind === kind);
                return options.length ? (
                  <optgroup key={kind} label={kinds[kind]}>
                    {options.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.title}
                        {item.artist ? ` · ${item.artist}` : ""} ({duration(item.duration)})
                      </option>
                    ))}
                  </optgroup>
                ) : null;
              })}
            </select>
          ) : (
            <>
              <input type="file" name="audio" accept={AUDIO_ACCEPT} onChange={(event) => setFile(event.target.files?.[0] ?? null)} className={`${input} file:mr-3 file:rounded-full file:border-0 file:bg-paper file:px-3 file:py-1 file:text-xs file:font-semibold`} />
              <p className="mt-1 text-[11px] text-muted">Se guarda también en la biblioteca como «Programa grabado». MP3, M4A, AAC, OGG, OPUS, WAV o FLAC · hasta {maxMb} MB.</p>
            </>
          )}
        </fieldset>

        <label className="text-xs font-semibold text-muted md:col-span-2">
          Título del episodio
          <input name="title" value={title} onChange={(event) => setTitle(event.target.value)} required minLength={3} maxLength={160} placeholder="Ej.: La fe que mueve montañas" className={input} />
        </label>
        <label className="text-xs font-semibold text-muted">
          Programa
          <input name="program" value={program} onChange={(event) => setProgram(event.target.value)} maxLength={120} list={listId} placeholder="Ej.: Mañanas con Zoe" className={input} />
          <datalist id={listId}>
            {programs.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </label>
        <label className="text-xs font-semibold text-muted">
          Fecha del programa
          <input type="date" name="aired_on" defaultValue={episode?.aired_on ?? today} required className={input} />
        </label>
        <label className="text-xs font-semibold text-muted md:col-span-2">
          Descripción corta
          <textarea
            name="description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={maxDescription}
            rows={3}
            placeholder="De qué trata este programa, en una o dos frases. Es lo que la gente lee antes de darle Play."
            className={`${input} resize-none`}
          />
          <span className="mt-1 block text-right text-[11px] font-normal tabular-nums">{description.length}/{maxDescription}</span>
        </label>
        <label className="flex items-center gap-2 text-sm md:col-span-2">
          <input type="checkbox" name="published" value="1" defaultChecked={episode?.published ?? true} /> Publicado: se ve en la página de la radio
        </label>

        <div className="md:col-span-2">
          <Notice result={result?.error ? result : null} onClose={() => setResult(null)} />
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <button disabled={busy} className={button}>
              {busy ? (source === "upload" && file ? `Subiendo… ${Math.round((progress ?? 0) * 100)}%` : "Guardando…") : episode ? "Guardar cambios" : "Guardar episodio"}
            </button>
            <button type="button" disabled={busy} onClick={onDone} className={ghost}>Cancelar</button>
          </div>
        </div>
      </div>
    </form>
  );
}
