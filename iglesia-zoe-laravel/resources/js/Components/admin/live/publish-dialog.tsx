import { useEffect, useRef, useState } from "react";
import { button, ghost, Notice } from "@/Components/admin/ui";
import { send, type ActionResult } from "@/lib/actions";
import type { Teaching } from "@/lib/types";
import { formatBytes } from "./recordings";
import type { Catalog, Recording, VideoOptions } from "./types";
import { appendOptions, editableOptions, VideoOptionsFields } from "./video-options";
import { uploadVideo } from "./video-upload";

export type AdminTeaching = Teaching & {
  summary: string;
  show_summary: boolean;
  youtube_privacy: string | null;
  youtube_status: "uploading" | "processing" | "ready" | "failed" | null;
  youtube_progress: number;
  youtube_error: string | null;
  youtube_options: VideoOptions | null;
  active: boolean;
  on_site: boolean;
  source: "manual" | "live";
  pending_upload: boolean;
  live_stream_id: string | null;
  recordings: Recording[];
};

export type VideoSettings = { canPublish: boolean; connected: boolean; accept: string; maxGb: number; retentionHours: number };

/** Sends a teaching's video to the church channel: the original recording or an edited file. */
export function PublishDialog({
  teaching,
  catalog,
  video,
  onClose,
  onDone,
}: {
  teaching: AdminTeaching;
  catalog: Catalog;
  video: VideoSettings;
  onClose: () => void;
  onDone: (result: ActionResult) => void;
}) {
  const recordings = teaching.recordings.filter((recording) => recording.download);
  const [source, setSource] = useState<"recording" | "upload">(recordings.length ? "recording" : "upload");
  const [recording, setRecording] = useState(recordings[0]?.id ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [options, setOptions] = useState<VideoOptions>(() => editableOptions({ ...catalog.defaults, ...(teaching.youtube_options ?? {}), publish_at: null }));
  const [progress, setProgress] = useState<number | null>(null);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [busy, setBusy] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    dialog.current?.showModal();
    return () => abort.current?.abort();
  }, []);

  useEffect(() => {
    if (!busy) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [busy]);

  function close() {
    if (busy && !window.confirm("¿Cancelar la subida del video?")) return;
    abort.current?.abort();
    onClose();
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (teaching.youtube_id && !window.confirm("Esta enseñanza ya tiene un video en YouTube. El nuevo tomará su lugar en la web; el anterior seguirá en el canal (puedes borrarlo desde YouTube Studio). ¿Continuar?")) return;
    setBusy(true);
    setResult(null);
    const formData = new FormData();
    formData.set("id", teaching.id);
    formData.set("source", source);
    if (teaching.youtube_id) formData.set("replace", "1");
    appendOptions(formData, options, "upload");

    try {
      if (source === "upload") {
        if (!file) throw new Error("Elige el video editado.");
        if (file.size > video.maxGb * 1024 ** 3) throw new Error(`El video puede pesar hasta ${video.maxGb} GB.`);
        abort.current = new AbortController();
        setProgress(0);
        formData.set("upload", await uploadVideo(file, setProgress, abort.current.signal));
      } else {
        formData.set("recording", recording);
      }
      const published = await send("/admin/recursos/publicar", formData);
      if (published.error) throw new Error(published.error);
      setBusy(false);
      onDone(published);
    } catch (error) {
      setBusy(false);
      setProgress(null);
      if (error instanceof DOMException && error.name === "AbortError") return;
      setResult({ error: error instanceof Error ? error.message : "No se pudo publicar el video." });
    }
  }

  return (
    <dialog
      ref={dialog}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      className="m-auto max-h-[92vh] w-[min(46rem,94vw)] overflow-y-auto rounded-[1.6rem] bg-card p-0 text-ink backdrop:bg-black/50"
    >
      <form onSubmit={submit} className="grid gap-5 p-5 md:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-orange-deep">{teaching.youtube_id ? "Subir video editado" : "Publicar en YouTube"}</p>
            <h2 className="mt-2 text-xl font-semibold tracking-[-0.02em]">{teaching.title}</h2>
            <p className="mt-1 text-xs text-muted">Se usan el título, la descripción y la miniatura de la enseñanza. Cuando YouTube entregue el enlace, aparecerá sola en la web.</p>
          </div>
          <button type="button" onClick={close} className="text-2xl leading-none text-muted" aria-label="Cerrar">
            ×
          </button>
        </div>

        <fieldset className="grid gap-2">
          <legend className="text-xs font-semibold text-muted">Video</legend>
          {recordings.length ? (
            <label className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 text-sm ${source === "recording" ? "border-ink" : "border-line"} bg-white`}>
              <input type="radio" checked={source === "recording"} onChange={() => setSource("recording")} className="mt-1" />
              <span className="min-w-0 flex-1">
                <span className="font-semibold">Grabación original de la transmisión</span>
                <span className="mt-0.5 block text-xs text-muted">Tal como llegó de OBS, en máxima calidad.</span>
                {source === "recording" && recordings.length > 1 ? (
                  <select value={recording} onChange={(event) => setRecording(event.target.value)} className="mt-2 w-full rounded-xl border border-line bg-white px-3 py-2 text-sm">
                    {recordings.map((item) => (
                      <option key={item.id} value={item.id}>
                        Parte {item.part} · {formatBytes(item.size)}
                      </option>
                    ))}
                  </select>
                ) : null}
              </span>
            </label>
          ) : null}
          <label className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 text-sm ${source === "upload" ? "border-ink" : "border-line"} bg-white`}>
            <input type="radio" checked={source === "upload"} onChange={() => setSource("upload")} className="mt-1" />
            <span className="min-w-0 flex-1">
              <span className="font-semibold">Video editado desde tu computadora</span>
              <span className="mt-0.5 block text-xs text-muted">MP4, MOV, MKV, WEBM o AVI hasta {video.maxGb} GB. Se sube por partes: si se corta el internet, continúa solo.</span>
              {source === "upload" ? (
                <input type="file" accept={video.accept} onChange={(event) => setFile(event.target.files?.[0] ?? null)} className="mt-2 block w-full text-xs" disabled={busy} />
              ) : null}
              {file ? <span className="mt-1 block text-xs text-muted">{file.name} · {formatBytes(file.size)}</span> : null}
            </span>
          </label>
        </fieldset>

        <VideoOptionsFields catalog={catalog} value={options} onChange={setOptions} mode="upload" connected={video.connected} />

        {progress !== null ? (
          <div>
            <div className="flex justify-between text-xs font-semibold text-muted">
              <span>Subiendo al servidor… no cierres esta pestaña</span>
              <span className="tabular-nums">{Math.floor(progress * 100)}%</span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-paper">
              <div className="h-full rounded-full bg-accent transition-[width] duration-300" style={{ width: `${progress * 100}%` }} />
            </div>
          </div>
        ) : null}

        <Notice result={result} onClose={() => setResult(null)} />
        <div className="flex flex-wrap gap-3">
          <button className={button} disabled={busy || (source === "upload" && !file)}>
            {busy ? (progress !== null && progress < 1 ? "Subiendo…" : "Enviando a YouTube…") : "Publicar en YouTube"}
          </button>
          <button type="button" className={ghost} onClick={close}>
            {busy ? "Cancelar subida" : "Cancelar"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
