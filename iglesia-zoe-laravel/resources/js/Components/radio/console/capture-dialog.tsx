import { useState } from "react";
import { EpisodeCover } from "@/Components/radio/episode-cover";
import { csrf } from "@/lib/actions";
import type { CaptureBrief } from "@/lib/radio/capture";
import { duration } from "@/lib/radio";

const input = "mt-1.5 w-full rounded-xl border border-ink/15 bg-white px-3 py-2.5 text-base text-ink outline-none focus:border-ink/40";

/** After a transmission, keep the audio as Programa grabado and optionally show it as an episode. */
export function CaptureDialog({
  recording,
  canEpisodes,
  maxDescription,
  host,
  episode = "",
  onClose,
  onDone,
}: {
  recording: CaptureBrief;
  canEpisodes: boolean;
  maxDescription: number;
  host: string;
  /** Name the transmission had on air. */
  episode?: string;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [title, setTitle] = useState(episode.trim() || (host.trim() ? `Transmisión de ${host.trim()}` : "Transmisión en vivo"));
  const [program, setProgram] = useState("");
  const [description, setDescription] = useState("");
  const [publish, setPublish] = useState(false);
  const [cover, setCover] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function chooseCover(file: File | null) {
    setCover(file);
    setPreview((current) => {
      if (current) URL.revokeObjectURL(current);
      return file ? URL.createObjectURL(file) : null;
    });
  }

  async function save() {
    if (title.trim().length < 3) {
      setError("Ponle un título de al menos 3 caracteres.");
      return;
    }
    setBusy(true);
    setError(null);
    const body = new FormData();
    body.set("action", "save");
    body.set("id", recording.id);
    body.set("title", title.trim());
    body.set("program", program.trim());
    body.set("description", description.trim());
    if (publish) body.set("publish", "1");
    if (cover) body.set("cover", cover);
    const response = await fetch("/admin/radio/grabacion", {
      method: "POST",
      body,
      headers: { "X-CSRF-TOKEN": csrf(), Accept: "application/json", "X-Requested-With": "XMLHttpRequest" },
    });
    const data = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok || data.error) {
      setError(data.error || data.message || "No se pudo guardar la grabación.");
      return;
    }
    onDone(data.message || "Grabación guardada.");
  }

  async function discard() {
    if (!window.confirm("¿Descartar esta grabación? El audio no se guardará.")) return;
    setBusy(true);
    const body = new FormData();
    body.set("action", "discard");
    body.set("id", recording.id);
    await fetch("/admin/radio/grabacion", {
      method: "POST",
      body,
      headers: { "X-CSRF-TOKEN": csrf(), Accept: "application/json", "X-Requested-With": "XMLHttpRequest" },
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-end overflow-y-auto bg-black/55 p-0 sm:place-items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="capture-title">
      <div className="max-h-[100dvh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 text-ink shadow-2xl sm:max-w-lg sm:rounded-3xl sm:p-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Programa grabado</p>
        <h2 id="capture-title" className="mt-1 text-2xl font-semibold tracking-[-0.03em]">Guardar la transmisión</h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          El audio queda en la biblioteca como Programa grabado{recording.duration ? ` · ${duration(recording.duration)}` : ""}. La imagen y la descripción son del episodio.
        </p>

        <div className="mt-5 grid gap-4">
          <label className="text-xs font-semibold text-muted">
            Título
            <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={160} required className={input} />
          </label>
          {canEpisodes ? (
            <>
              <label className="text-xs font-semibold text-muted">
                Programa
                <input value={program} onChange={(event) => setProgram(event.target.value)} maxLength={120} placeholder="Ej.: Culto del domingo" className={input} />
              </label>
              <label className="text-xs font-semibold text-muted">
                De qué trató
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  maxLength={maxDescription}
                  rows={4}
                  placeholder="Escribe de qué trató este episodio. Es lo que la gente lee antes de escucharlo."
                  className={`${input} resize-y`}
                />
                <span className="mt-1 block text-right text-[11px] font-normal tabular-nums">{description.length}/{maxDescription}</span>
              </label>
              <div className="grid gap-3 sm:grid-cols-[7.5rem_minmax(0,1fr)] sm:items-center">
                <EpisodeCover src={preview} title={title || "Episodio"} className="aspect-square w-full rounded-2xl" />
                <label className="text-xs font-semibold text-muted">
                  Imagen del episodio
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(event) => chooseCover(event.target.files?.[0] ?? null)}
                    className={`${input} file:mr-3 file:rounded-full file:border-0 file:bg-paper file:px-3 file:py-1 file:text-xs file:font-semibold`}
                  />
                  <span className="mt-1 block font-normal text-muted">JPG, PNG o WEBP · hasta 8 MB. Opcional.</span>
                </label>
              </div>
              <label className="flex items-start gap-2 text-sm leading-5">
                <input type="checkbox" checked={publish} onChange={(event) => setPublish(event.target.checked)} className="mt-1" />
                <span>Publicar en la página, en la sección <strong>Episodios</strong>, para que la gente lo escuche.</span>
              </label>
            </>
          ) : (
            <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm leading-5 text-amber-900">Puedes guardar el audio. Para publicarlo como episodio hace falta el permiso de Episodios.</p>
          )}
        </div>

        {error ? <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">{error}</p> : null}

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          <button type="button" disabled={busy} onClick={discard} className="rounded-full px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50">Descartar</button>
          <div className="flex gap-2">
            <button type="button" disabled={busy} onClick={save} className="btn-accent flex-1 rounded-full px-5 py-2.5 text-sm font-semibold disabled:opacity-60 sm:flex-none">
              {busy ? "Guardando…" : publish ? "Guardar y publicar" : "Guardar audio"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
