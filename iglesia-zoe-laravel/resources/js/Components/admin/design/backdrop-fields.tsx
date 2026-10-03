import { useState } from "react";
import { send } from "@/lib/actions";
import type { Backdrop, BackdropFit } from "@/lib/design";
import { ColorField, RangeField, SelectField, Toggle } from "./fields";

const fits: { value: BackdropFit; label: string }[] = [
  { value: "cover", label: "Cubrir todo el espacio" },
  { value: "contain", label: "Mostrar la imagen completa" },
  { value: "repeat", label: "Repetir como mosaico" },
];

const percent = (value: number) => `${Math.round(value * 100)} %`;

/** Color, gradient, picture or GIF, video and tint of a page (the screen) or of one band. */
export function BackdropFields({ rule, base, set, where }: { rule: Backdrop; base: string; set: (patch: Partial<Backdrop>) => void; where: "page" | "section" }) {
  const hasMedia = Boolean(rule.image || rule.video);
  return (
    <div className="space-y-4">
      <div className="grid gap-2.5">
        <ColorField label="Color de fondo" text={where === "page" ? "Igual que la web" : "Igual que la página"} value={rule.background} fallback={base} onChange={(background) => set({ background })} />
        <ColorField label="Degradado hacia" text="Sin degradado" value={rule.background2} fallback={rule.background || base} onChange={(background2) => set({ background2, gradient: background2 ? rule.gradient : undefined })} />
        {rule.background2 && (
          <RangeField label="Dirección del degradado" value={rule.gradient} fallback={180} min={0} max={360} step={5} format={(value) => `${value}°`} onChange={(gradient) => set({ gradient })} />
        )}
      </div>

      <MediaPicker image={rule.image} video={rule.video} where={where} onChange={(image, video) => set({ image, video, ...(image || video ? {} : { imageFit: undefined, imageX: undefined, imageY: undefined, fixed: undefined, overlay: undefined, overlayColor: undefined }) })} />

      {rule.image && (
        <div className="space-y-4">
          <SelectField<BackdropFit> label="Cómo se acomoda" value={rule.imageFit} options={fits} placeholder="Cubrir todo el espacio (recomendado)" onChange={(imageFit) => set({ imageFit })} />
          <RangeField label="Punto de enfoque horizontal" value={rule.imageX} fallback={50} min={0} max={100} step={1} format={(value) => `${value} %`} onChange={(imageX) => set({ imageX })} />
          <RangeField label="Punto de enfoque vertical" value={rule.imageY} fallback={50} min={0} max={100} step={1} format={(value) => `${value} %`} onChange={(imageY) => set({ imageY })} />
        </div>
      )}

      {hasMedia && (
        <div className="space-y-4">
          <RangeField label="Velo sobre el fondo" value={rule.overlay} fallback={0} min={0} max={0.85} step={0.05} format={percent} onChange={(overlay) => set({ overlay: overlay || undefined })} />
          {Boolean(rule.overlay) && <ColorField label="Color del velo" text="Negro" value={rule.overlayColor} fallback="#000000" onChange={(overlayColor) => set({ overlayColor })} />}
          <Toggle
            label={where === "page" ? "Fondo quieto al desplazar" : "Efecto parallax"}
            text={where === "page" ? "El fondo se queda fijo mientras el contenido sube." : "La imagen se queda quieta mientras la franja pasa."}
            checked={Boolean(rule.fixed)}
            onChange={(fixed) => set({ fixed })}
          />
        </div>
      )}
    </div>
  );
}

function MediaPicker({ image, video, where, onChange }: { image?: string; video?: string; where: "page" | "section"; onChange: (image: string | undefined, video: string | undefined) => void }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const src = image || video;

  async function upload(file: File | undefined) {
    if (!file) return;
    setPending(true);
    setError("");
    const result = await send("/admin/diseno/fondo", { file });
    setPending(false);
    if (result.ok && typeof result.src === "string") onChange(result.kind === "video" ? undefined : result.src, result.kind === "video" ? result.src : undefined);
    else setError(result.error || "No se pudo subir el archivo.");
  }

  return (
    <div className="rounded-2xl border border-line bg-white p-3">
      <p className="text-sm font-semibold">{where === "page" ? "Fondo de pantalla" : "Fondo de la franja"}</p>
      <p className="mt-0.5 text-[11px] leading-4 text-muted">Foto, GIF animado o video corto. Imagen hasta 12 MB, video hasta 60 MB.</p>
      {src && (
        <div className="relative mt-3 aspect-video overflow-hidden rounded-xl bg-[#e9e6e1]">
          {video ? <video src={video} muted loop autoPlay playsInline className="h-full w-full object-cover" /> : <img src={image} alt="" className="h-full w-full object-cover" />}
          <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-white">{video ? "Video" : image?.toLowerCase().endsWith(".gif") ? "GIF" : "Imagen"}</span>
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label className={`cursor-pointer rounded-full bg-ink px-4 py-2 text-xs font-semibold text-white transition hover:bg-ink/85 ${pending ? "pointer-events-none opacity-60" : ""}`}>
          {pending ? "Subiendo…" : src ? "Cambiar archivo" : "Subir archivo"}
          <input type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif,video/mp4,video/webm,video/quicktime" className="sr-only" onChange={(event) => { upload(event.target.files?.[0]); event.target.value = ""; }} />
        </label>
        {src && <button type="button" onClick={() => onChange(undefined, undefined)} className="text-xs font-semibold text-muted hover:text-ink">Quitar</button>}
      </div>
      {error && <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-800">{error}</p>}
    </div>
  );
}
