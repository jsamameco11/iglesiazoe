import { useEffect, useMemo, useState } from "react";
import { button, ghost, input, Notice, useAction } from "@/Components/admin/ui";
import { send, type ActionResult } from "@/lib/actions";
import type { BroadcastDefaults, Catalog, LiveStream, VideoOptions, YouTubeInfo } from "./types";
import { appendOptions, editableOptions, VideoOptionsFields } from "./video-options";

type Props = {
  catalog: Catalog;
  youtube: YouTubeInfo;
  initial: LiveStream | BroadcastDefaults;
  mode: "broadcast" | "defaults";
  onSaved?: (result: ActionResult) => void;
  onCancel?: () => void;
};

/** Title, description and every YouTube option of a broadcast (or of the defaults new broadcasts start from). */
export function BroadcastForm({ catalog, youtube, initial, mode, onSaved, onCancel }: Props) {
  const stream = "id" in initial ? initial : null;
  const [title, setTitle] = useState(initial.title);
  const [description, setDescription] = useState(initial.description);
  const [preacher, setPreacher] = useState(initial.preacher);
  const [kind, setKind] = useState(initial.kind);
  const [showSummary, setShowSummary] = useState(initial.show_summary);
  const [toYoutube, setToYoutube] = useState(initial.to_youtube);
  const [options, setOptions] = useState<VideoOptions>(() => editableOptions(initial.options));
  const [cover, setCover] = useState<File | null>(null);
  const [removeCover, setRemoveCover] = useState(false);
  const { result, setResult, pending, run } = useAction();

  const canYoutube = youtube.connected || youtube.manualKey;
  const onlyKey = !youtube.connected && youtube.manualKey;
  const locked = stream?.status === "live";
  const picked = useMemo(() => (cover ? URL.createObjectURL(cover) : null), [cover]);
  useEffect(() => () => (picked ? URL.revokeObjectURL(picked) : undefined), [picked]);
  const preview = picked ?? (removeCover ? null : (stream?.cover ?? null));

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const formData = new FormData();
    if (stream) formData.set("id", stream.id);
    formData.set("title", title);
    formData.set("description", description);
    formData.set("preacher", preacher);
    formData.set("kind", kind);
    formData.set("show_summary", showSummary ? "1" : "0");
    formData.set("to_youtube", toYoutube ? "1" : "0");
    if (cover) formData.set("cover", cover);
    if (removeCover) formData.set("remove_cover", "1");
    appendOptions(formData, options, mode === "defaults" ? "defaults" : "live");
    run(() => send(mode === "defaults" ? "/admin/transmision/predeterminados" : "/admin/transmision", formData), (saved) => onSaved?.(saved));
  }

  return (
    <form onSubmit={submit} className="grid gap-6">
      <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
        <div className="grid gap-4">
          <label className="text-xs font-semibold text-muted">
            Título <span className="font-normal">({title.length}/100)</span>
            <input value={title} onChange={(event) => setTitle(event.target.value)} required minLength={3} maxLength={100} placeholder="Ej. Domingo de celebración · Fe que mueve montañas" className={input} />
          </label>
          <label className="text-xs font-semibold text-muted">
            Descripción <span className="font-normal">({description.length}/5000)</span>
            <textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={5000} rows={5} placeholder="De qué trata la reunión, versículos, enlaces…" className={input} />
          </label>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-xs font-semibold text-muted">
              Predicador
              <input value={preacher} onChange={(event) => setPreacher(event.target.value)} maxLength={120} placeholder="Ej. Pastor Juan Pérez" className={input} />
            </label>
            <label className="text-xs font-semibold text-muted">
              Se guarda en Enseñanzas como
              <select value={kind} onChange={(event) => setKind(event.target.value as typeof kind)} className={input}>
                {(catalog.kinds ?? []).map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="flex items-center gap-3 text-sm">
            <input type="checkbox" checked={showSummary} onChange={(event) => setShowSummary(event.target.checked)} className="h-4 w-4 accent-[var(--accent)]" />
            Mostrar la descripción en la página web
          </label>
        </div>

        {mode === "broadcast" ? (
          <div className="text-xs font-semibold text-muted">
            Miniatura
            <div className="mt-1.5 grid aspect-video place-items-center overflow-hidden rounded-2xl border border-dashed border-line bg-paper">
              {preview ? <img src={preview} alt="" className="h-full w-full object-cover" /> : <span className="px-4 text-center font-normal">1280 × 720 · JPG o PNG hasta 2 MB</span>}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <label className={`${ghost} cursor-pointer px-3 py-1.5 text-xs`}>
                {preview ? "Cambiar" : "Elegir imagen"}
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png"
                  className="sr-only"
                  onChange={(event) => {
                    setCover(event.target.files?.[0] ?? null);
                    setRemoveCover(false);
                  }}
                />
              </label>
              {preview ? (
                <button
                  type="button"
                  className={`${ghost} px-3 py-1.5 text-xs`}
                  onClick={() => {
                    setCover(null);
                    setRemoveCover(Boolean(stream?.cover));
                  }}
                >
                  Quitar
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      <div className="rounded-[1.4rem] border border-line bg-paper/60 p-4 md:p-5">
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" checked={toYoutube && canYoutube} disabled={!canYoutube || locked} onChange={(event) => setToYoutube(event.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--accent)]" />
          <span>
            <span className="font-semibold">Transmitir también en YouTube y guardar el video en el canal</span>
            <span className="mt-0.5 block text-xs text-muted">
              {!canYoutube
                ? "Conecta el canal de YouTube (más abajo) para activarlo. Sin YouTube, la transmisión se ve solo en la web y la grabación queda para descargar."
                : locked
                  ? "Ya está al aire: este ajuste no se puede cambiar ahora."
                  : "Si lo desactivas, se transmite solo en la web; la enseñanza se guarda igual y luego puedes subir el video editado."}
            </span>
          </span>
        </label>
        {toYoutube && canYoutube ? (
          <div className="mt-5">
            {onlyKey ? (
              <p className="mb-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
                Con la clave manual, YouTube usa el título y las opciones que tengas en YouTube Studio. Conecta la cuenta para que se completen solas desde aquí.
              </p>
            ) : null}
            <VideoOptionsFields catalog={catalog} value={options} onChange={setOptions} mode={mode === "defaults" ? "defaults" : "live"} connected={youtube.connected} />
          </div>
        ) : null}
      </div>

      <Notice result={result} onClose={() => setResult(null)} />
      <div className="flex flex-wrap gap-3">
        <button className={button} disabled={pending}>
          {pending ? "Guardando…" : mode === "defaults" ? "Guardar valores por defecto" : stream ? "Guardar cambios" : "Preparar transmisión"}
        </button>
        {onCancel ? (
          <button type="button" className={ghost} onClick={onCancel}>
            Cancelar
          </button>
        ) : null}
      </div>
    </form>
  );
}
