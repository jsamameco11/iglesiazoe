import { Link, router } from "@inertiajs/react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { AUDIO_ACCEPT, COVER_ACCEPT, KindTag, RadioHeader, postWithProgress, readDuration } from "@/Components/radio/admin-ui";
import { Notice, Stat, button, ghost, input, useAction } from "@/Components/admin/ui";
import AdminLayout from "@/Layouts/AdminLayout";
import { can, usePanelUser } from "@/lib/access";
import { send } from "@/lib/actions";
import { duration, longDuration, type RadioTrack } from "@/lib/radio";
import "../../../../css/radio.css";

type Kind = RadioTrack["kind"];

type Props = { tracks: RadioTrack[]; kinds: Record<Kind, string>; maxMb: number; maxDescription: number };

type Upload = {
  key: string;
  file: File;
  title: string;
  artist: string;
  kind: Kind;
  duck: boolean;
  duration: number | null;
  progress: number;
  status: "ready" | "reading" | "uploading" | "done" | "error";
  error?: string;
  /** Also publish it on /radio as an episode, with this description and cover. */
  episode: boolean;
  description: string;
  cover: File | null;
};

const LIBRARY = "/admin/radio/biblioteca";

/** Spoken audio lowers the music by default when it plays on top of it. */
const duckFor = (kind: Kind) => kind === "anuncio" || kind === "programa";

const upload = (data: FormData, onProgress?: (value: number) => void) => postWithProgress(LIBRARY, data, onProgress);

function cleanTitle(name: string) {
  return name
    .replace(/\.[^.]+$/, "")
    .replace(/[_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
}

function guessArtist(title: string): [string, string] {
  const parts = title.split(/\s+-\s+/);
  return parts.length === 2 ? [parts[1].trim(), parts[0].trim()] : [title, ""];
}

export default function Biblioteca({ tracks, kinds, maxMb, maxDescription }: Props) {
  const canEpisodes = can(usePanelUser(), "radio.episodes");
  const [tab, setTab] = useState<Kind | "">("");
  const [query, setQuery] = useState("");
  const [queue, setQueue] = useState<Upload[]>([]);
  const [uploadKind, setUploadKind] = useState<Kind>("musica");
  const [running, setRunning] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const picker = useRef<HTMLInputElement>(null);

  useEffect(() => () => audio.current?.pause(), []);

  const music = tracks.filter((track) => track.kind === "musica");
  const rotation = music.filter((track) => track.rotation && track.active);
  const shown = tracks.filter((track) => (!tab || track.kind === tab) && `${track.title} ${track.artist ?? ""}`.toLowerCase().includes(query.trim().toLowerCase()));
  const kindList = Object.keys(kinds) as Kind[];

  function patch(key: string, values: Partial<Upload>) {
    setQueue((list) => list.map((item) => (item.key === key ? { ...item, ...values } : item)));
  }

  function addFiles(files: FileList | null) {
    if (!files?.length) return;
    const fresh: Upload[] = Array.from(files).map((file, index) => {
      const [title, artist] = guessArtist(cleanTitle(file.name));
      const tooBig = file.size > maxMb * 1024 * 1024;
      return {
        key: `${Date.now()}-${index}-${file.name}`,
        file,
        title,
        artist: uploadKind === "musica" ? artist : "",
        kind: uploadKind,
        duck: duckFor(uploadKind),
        duration: null,
        progress: 0,
        status: tooBig ? "error" : "reading",
        error: tooBig ? `Pesa más de ${maxMb} MB. Expórtalo en MP3 (128–192 kbps).` : undefined,
        episode: false,
        description: "",
        cover: null,
      };
    });
    setQueue((list) => [...list, ...fresh]);
    fresh
      .filter((item) => item.status === "reading")
      .forEach(async (item) => {
        const seconds = await readDuration(item.file);
        patch(item.key, seconds ? { duration: seconds, status: "ready" } : { status: "error", error: "No pudimos leer este audio. Prueba con MP3 o M4A." });
      });
  }

  async function uploadAll() {
    setRunning(true);
    let uploaded = 0;
    for (const item of queue) {
      if (item.status !== "ready" || !item.duration) continue;
      patch(item.key, { status: "uploading", progress: 0 });
      const data = new FormData();
      data.set("title", item.title.trim() || cleanTitle(item.file.name));
      data.set("artist", item.artist);
      data.set("kind", item.kind);
      data.set("duration", String(item.duration));
      data.set("duck", item.duck ? "1" : "0");
      data.set("audio", item.file);
      if (canEpisodes && item.episode) {
        data.set("episode", "1");
        data.set("episode_description", item.description);
        if (item.cover) data.set("episode_cover", item.cover);
      }
      const result = await upload(data, (progress) => patch(item.key, { progress }));
      if (result.error) patch(item.key, { status: "error", error: result.error });
      else {
        patch(item.key, { status: "done", progress: 1 });
        uploaded++;
      }
    }
    setRunning(false);
    if (uploaded) {
      router.reload({ only: ["tracks"] });
      setQueue((list) => list.filter((item) => item.status !== "done"));
    }
  }

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

  const ready = queue.filter((item) => item.status === "ready").length;

  return (
    <AdminLayout>
      <RadioHeader
        title="Biblioteca de audio"
        text="Aquí guardas los recursos de la radio: canciones, anuncios grabados, efectos y cortinas, y programas pregrabados. Subir un audio no lo pone al aire: suena solo cuando lo programas o lo lanzas desde la consola. Una canción se repite en la música continua únicamente si activas «Se repite»."
      />

      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Audios en la biblioteca" value={tracks.length} />
        <Stat
          label="En la música continua"
          value={rotation.length}
          note={rotation.length === 1 ? "Una sola canción: se repetirá sin parar" : rotation.length ? `${longDuration(rotation.reduce((sum, track) => sum + track.duration, 0))} antes de repetir` : "Ninguna se repite sola"}
          tone="bg-[#f4efe6]"
        />
        <Stat label="Anuncios y efectos" value={tracks.filter((track) => track.kind === "anuncio" || track.kind === "efecto").length} note="Elígelos para la botonera de la consola" />
        <Stat label="Programas grabados" value={tracks.filter((track) => track.kind === "programa").length} />
      </div>

      <section
        className="mt-6 rounded-[1.6rem] border-2 border-dashed border-line bg-card p-5 transition md:p-6"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          addFiles(event.dataTransfer.files);
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold tracking-[-0.025em]">Subir audios</h2>
            <p className="mt-1 text-[13px] leading-5 text-muted">Arrastra aquí varios archivos o elígelos. MP3, M4A, AAC, OGG, OPUS, WAV o FLAC · hasta {maxMb} MB cada uno.</p>
            <p className="mt-1 text-[12.5px] font-medium text-emerald-800">Nada empieza a sonar al subir: todo queda guardado para programarlo.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select value={uploadKind} onChange={(event) => setUploadKind(event.target.value as Kind)} className={`${input} !mt-0 !w-auto`}>
              {kindList.map((kind) => (
                <option key={kind} value={kind}>Subir como: {kinds[kind]}</option>
              ))}
            </select>
            <button type="button" onClick={() => picker.current?.click()} className={button}>Elegir archivos</button>
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

        {queue.length ? (
          <div className="mt-5 space-y-2">
            {queue.map((item) => (
              <div key={item.key} className="grid gap-2 rounded-2xl border border-line bg-white p-3 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_10rem_auto_auto] md:items-center">
                <input value={item.title} disabled={item.status === "uploading"} onChange={(event) => patch(item.key, { title: event.target.value })} className={`${input} !mt-0`} placeholder="Título" maxLength={160} />
                <input value={item.artist} disabled={item.status === "uploading"} onChange={(event) => patch(item.key, { artist: event.target.value })} className={`${input} !mt-0`} placeholder={item.kind === "programa" ? "Programa o locutor (opcional)" : "Artista (opcional)"} maxLength={120} />
                <select value={item.kind} disabled={item.status === "uploading"} onChange={(event) => patch(item.key, { kind: event.target.value as Kind, duck: duckFor(event.target.value as Kind) })} className={`${input} !mt-0`}>
                  {kindList.map((kind) => (
                    <option key={kind} value={kind}>{kinds[kind]}</option>
                  ))}
                </select>
                <label className="flex items-center gap-2 text-xs" title="Cuando suene encima de la música, la música baja para que se escuche mejor.">
                  <input type="checkbox" checked={item.duck} onChange={(event) => patch(item.key, { duck: event.target.checked })} /> Baja la música
                </label>
                <div className="flex items-center justify-end gap-3 text-xs">
                  <span className="font-mono tabular-nums text-muted">{item.duration ? duration(item.duration) : "--:--"}</span>
                  {item.status === "uploading" || item.status === "done" ? (
                    <span className="w-20 overflow-hidden rounded-full bg-paper">
                      <span className="block h-1.5 rounded-full bg-accent transition-[width]" style={{ width: `${Math.round(item.progress * 100)}%` }} />
                    </span>
                  ) : (
                    <button type="button" disabled={running} onClick={() => setQueue((list) => list.filter((entry) => entry.key !== item.key))} className="px-1 text-base text-muted hover:text-red-700" aria-label="Quitar">
                      ×
                    </button>
                  )}
                </div>
                {canEpisodes ? (
                  <div className="md:col-span-5">
                    <label className="inline-flex items-center gap-2 text-[13px] font-semibold">
                      <input type="checkbox" checked={item.episode} disabled={item.status === "uploading"} onChange={(event) => patch(item.key, { episode: event.target.checked })} />
                      Publicar también como episodio en la página de la radio
                    </label>
                    {item.episode ? (
                      <div className="mt-2 grid gap-3 rounded-xl bg-paper p-3 md:grid-cols-[minmax(0,1fr)_16rem]">
                        <label className="text-xs font-semibold text-muted">
                          Descripción corta del programa
                          <textarea
                            value={item.description}
                            disabled={item.status === "uploading"}
                            onChange={(event) => patch(item.key, { description: event.target.value })}
                            maxLength={maxDescription}
                            rows={2}
                            placeholder="De qué trata este programa, en una o dos frases."
                            className={`${input} resize-none`}
                          />
                          <span className="mt-1 block text-right text-[11px] font-normal tabular-nums">{item.description.length}/{maxDescription}</span>
                        </label>
                        <label className="text-xs font-semibold text-muted">
                          Carátula (opcional)
                          <input type="file" accept={COVER_ACCEPT} disabled={item.status === "uploading"} onChange={(event) => patch(item.key, { cover: event.target.files?.[0] ?? null })} className={`${input} file:mr-3 file:rounded-full file:border-0 file:bg-paper file:px-3 file:py-1 file:text-xs file:font-semibold`} />
                          <span className="mt-1 block text-[11px] font-normal">JPG, PNG o WEBP cuadrada · hasta 8 MB</span>
                        </label>
                      </div>
                    ) : null}
                  </div>
                ) : null}
                {item.status === "error" ? <p className="text-xs font-medium text-red-700 md:col-span-5">{item.file.name}: {item.error}</p> : null}
                {item.status === "reading" ? <p className="text-xs text-muted md:col-span-5">Leyendo la duración…</p> : null}
              </div>
            ))}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button type="button" disabled={running || ready === 0} onClick={uploadAll} className={button}>
                {running ? "Subiendo…" : `Subir ${ready} audio${ready === 1 ? "" : "s"}`}
              </button>
              <button type="button" disabled={running} onClick={() => setQueue([])} className={ghost}>Limpiar lista</button>
            </div>
          </div>
        ) : null}
      </section>

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
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por título o artista…" className={`${input} !mt-0 ml-auto !w-full sm:!w-64`} />
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
  maxMb,
  canEpisodes,
  playing,
  editing,
  onPlay,
  onEdit,
}: {
  track: RadioTrack;
  kinds: Record<Kind, string>;
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

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    data.set("id", track.id);
    data.set("active", data.get("active") ? "1" : "0");
    data.set("duck", data.get("duck") ? "1" : "0");
    data.delete("audio");
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
      data.set("audio", file);
      data.set("duration", String(seconds));
    }
    run(
      () => upload(data).then((response) => {
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
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm transition ${playing ? "bg-ink text-white" : "bg-paper text-ink hover:bg-ink hover:text-white"}`}
          aria-label={playing ? "Detener" : "Escuchar"}
        >
          {playing ? "■" : "▶"}
        </button>
        <div className="min-w-0 flex-1">
          <p className={`truncate text-[15px] font-semibold ${track.active ? "" : "text-muted line-through"}`}>{track.title}</p>
          <p className="truncate text-[12.5px] text-muted">
            {track.artist ? `${track.artist} · ` : ""}
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
          <button type="button" onClick={onEdit} className="rounded-full px-3 py-1.5 text-xs font-semibold text-muted transition hover:bg-paper hover:text-ink">{editing ? "Cerrar" : "Editar"}</button>
          <button type="button" disabled={pending} onClick={remove} className="rounded-full px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-50">Eliminar</button>
        </div>
      </div>
      {editing ? (
        <form onSubmit={save} className="mt-3 grid gap-3 rounded-2xl border border-line bg-white p-4 md:grid-cols-2">
          <label className="text-xs font-semibold text-muted">
            Título
            <input name="title" defaultValue={track.title} required maxLength={160} className={input} />
          </label>
          <label className="text-xs font-semibold text-muted">
            Artista
            <input name="artist" defaultValue={track.artist ?? ""} maxLength={120} className={input} />
          </label>
          <label className="text-xs font-semibold text-muted">
            Tipo
            <select name="kind" value={kind} onChange={(event) => setKind(event.target.value as Kind)} className={input}>
              {(Object.keys(kinds) as Kind[]).map((value) => (
                <option key={value} value={value}>{kinds[value]}</option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold text-muted">
            Reemplazar archivo (opcional)
            <input type="file" name="audio" accept={AUDIO_ACCEPT} onChange={(event) => setFile(event.target.files?.[0] ?? null)} className={`${input} file:mr-3 file:rounded-full file:border-0 file:bg-paper file:px-3 file:py-1 file:text-xs file:font-semibold`} />
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
            <button disabled={pending} className={`${button} mt-2`}>{pending ? "Guardando…" : "Guardar cambios"}</button>
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
