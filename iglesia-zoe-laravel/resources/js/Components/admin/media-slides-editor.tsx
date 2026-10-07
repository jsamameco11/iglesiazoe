import { router } from "@inertiajs/react";
import { useState } from "react";
import { ImageComposer } from "@/Components/admin/image-composer";
import type { AdminMediaSlot } from "@/Components/admin/media-manager";
import { send } from "@/lib/actions";
import { clampFocus, MAX_SLIDES, mediaFocusStyle, normalizeFeather, normalizeFit, normalizeRadius, normalizeZoom, parseRatio, slidesOf } from "@/lib/media";

const SLIDE_MAX_BYTES = 12 * 1024 * 1024;
const IMAGE_TYPES = /^image\/(jpeg|png|webp|gif|avif)$/;
const field = "mt-1 w-full rounded-xl border border-line bg-white px-3 py-2";
const chip = "rounded-full border border-line bg-white px-2.5 py-1 text-[11px] font-medium transition hover:border-ink/30 disabled:cursor-not-allowed disabled:opacity-40";

type Notice = { tone: "ok" | "error"; text: string } | null;

function reloadPage() {
  return new Promise<void>((resolve) => router.reload({ onFinish: () => resolve() }));
}

/** Extra photos of a slot: the site turns them into a carousel with the main photo first. */
export function MediaSlidesEditor({ slot, compact = false, onSaved }: { slot: AdminMediaSlot; compact?: boolean; onSaved?: () => void }) {
  const photos = slot.asset.kind === "image" ? slidesOf(slot.asset) : [];
  const extra = Math.max(0, photos.length - 1);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState<Notice>(null);
  const [framing, setFraming] = useState<{ index: number; alt: string; posX: number; posY: number; zoom: number } | null>(null);

  const original = slot.custom
    ? {}
    : {
        base_src: slot.asset.src,
        base_alt: slot.asset.alt,
        base_ratio: slot.asset.ratio,
        base_fit: slot.asset.fit,
        base_posX: slot.asset.posX == null ? undefined : String(slot.asset.posX),
        base_posY: slot.asset.posY == null ? undefined : String(slot.asset.posY),
        base_zoom: slot.asset.zoom == null ? undefined : String(slot.asset.zoom),
        base_radius: slot.asset.radius == null ? undefined : String(slot.asset.radius),
        base_feather: slot.asset.feather == null ? undefined : String(slot.asset.feather),
      };

  async function run(label: string, payload: Record<string, string | Blob | undefined>, done: string) {
    setBusy(label);
    setNotice(null);
    const result = await send("/admin/medios/carrusel", { id: slot.id, ...original, ...payload });
    if (result?.ok) {
      await reloadPage();
      onSaved?.();
      setNotice({ tone: "ok", text: done });
      setFraming(null);
    } else {
      setNotice({ tone: "error", text: result?.error || "No se pudo guardar el carrusel." });
    }
    setBusy("");
    return Boolean(result?.ok);
  }

  async function upload(files: File[]) {
    const room = MAX_SLIDES - extra;
    const valid = files.filter((file) => IMAGE_TYPES.test(file.type) && file.size <= SLIDE_MAX_BYTES);
    const skipped = files.length - valid.length;
    const queue = valid.slice(0, room);
    if (!queue.length) {
      setNotice({ tone: "error", text: room <= 0 ? `El carrusel ya tiene ${MAX_SLIDES} fotos además de la principal.` : "Elige fotos JPG, PNG, WebP, GIF o AVIF de hasta 12 MB." });
      return;
    }
    setNotice(null);
    let added = 0;
    for (const [position, file] of queue.entries()) {
      setBusy(`Subiendo foto ${position + 1} de ${queue.length}…`);
      const result = await send("/admin/medios/carrusel", { id: slot.id, ...original, intent: "add", file });
      if (!result?.ok) {
        setNotice({ tone: "error", text: result?.error || `No se pudo subir «${file.name}».` });
        break;
      }
      added += 1;
    }
    if (added) {
      setBusy("Actualizando…");
      await reloadPage();
      onSaved?.();
      const left = valid.length - queue.length + skipped;
      setNotice((current) => current ?? { tone: "ok", text: `${added === 1 ? "Se agregó 1 foto" : `Se agregaron ${added} fotos`} al carrusel.${left ? ` ${left} no se subieron (formato, peso o límite de ${MAX_SLIDES}).` : ""}` });
    }
    setBusy("");
  }

  const ratioCss = parseRatio(slot.asset.ratio).css || "4 / 5";

  return (
    <section className={`border-t border-line pt-5 ${compact ? "" : "md:col-span-2"}`} aria-label={`Carrusel de ${slot.label}`}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-base font-medium tracking-[-0.02em]">Más fotos en este lugar</h3>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted">
            Con dos o más fotos el sitio muestra un carrusel: pasan solas cada 5 segundos, con flechas a los lados y barritas debajo. Todas usan la proporción, los bordes y el modo de arriba.
          </p>
        </div>
        {photos.length ? (
          <span className="rounded-full bg-sage px-3 py-1 text-xs font-medium">
            {photos.length === 1 ? "1 foto · sin carrusel" : `${photos.length} fotos en el carrusel`}
          </span>
        ) : null}
      </div>

      {slot.asset.kind !== "image" ? (
        <p className="mt-4 rounded-xl bg-paper px-3 py-2 text-sm text-muted">Este lugar muestra un video. Para usar varias fotos, publica primero una imagen como foto principal.</p>
      ) : (
        <>
          <ul className={`mt-4 grid gap-3 ${compact ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"}`}>
            {photos.map((photo, position) => {
              const index = position - 1;
              const main = position === 0;
              return (
                <li key={`${photo.src}-${position}`} className={`overflow-hidden rounded-2xl border bg-white ${framing?.index === index && !main ? "border-ink/40 ring-2 ring-ink/10" : "border-line"}`}>
                  <div className="relative aspect-[4/3] overflow-hidden bg-paper">
                    <img src={photo.src} alt={photo.alt} className="h-full w-full object-cover" style={mediaFocusStyle(photo)} loading="lazy" draggable={false} />
                    <span className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${main ? "bg-ink text-white" : "bg-white/90 text-ink"}`}>
                      {main ? "Principal" : position + 1}
                    </span>
                  </div>
                  {main ? (
                    <p className="px-2.5 py-2 text-[11px] leading-4 text-muted">Se cambia y encuadra con el formulario de arriba.</p>
                  ) : (
                    <div className="flex flex-wrap gap-1 p-2">
                      <button type="button" className={chip} disabled={!!busy || index === 0} aria-label={`Mover la foto ${position + 1} a la izquierda`} onClick={() => run("Moviendo…", { intent: "move", index: String(index), direction: "left" }, "Orden actualizado.")}>
                        ←
                      </button>
                      <button type="button" className={chip} disabled={!!busy || index === extra - 1} aria-label={`Mover la foto ${position + 1} a la derecha`} onClick={() => run("Moviendo…", { intent: "move", index: String(index), direction: "right" }, "Orden actualizado.")}>
                        →
                      </button>
                      <button
                        type="button"
                        className={chip}
                        disabled={!!busy}
                        onClick={() => {
                          setNotice(null);
                          setFraming({ index, alt: slot.asset.slides?.[index]?.alt || "", posX: clampFocus(photo.posX), posY: clampFocus(photo.posY), zoom: normalizeZoom(photo.zoom) });
                        }}
                      >
                        Encuadrar
                      </button>
                      <button type="button" className={chip} disabled={!!busy} onClick={() => run("Cambiando la principal…", { intent: "promote", index: String(index) }, "Ahora es la foto principal.")}>
                        Hacer principal
                      </button>
                      <button
                        type="button"
                        className={`${chip} text-red-700 hover:border-red-300`}
                        disabled={!!busy}
                        onClick={() => {
                          if (window.confirm("¿Quitar esta foto del carrusel? Se borrará del sitio.")) run("Quitando…", { intent: "remove", index: String(index) }, "Foto quitada.");
                        }}
                      >
                        Quitar
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
            {extra < MAX_SLIDES ? (
              <li>
                <label className={`flex h-full min-h-40 w-full cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-line bg-paper/60 px-3 text-center transition hover:border-ink/30 ${busy ? "pointer-events-none opacity-60" : ""}`}>
                  <span className="text-2xl leading-none text-muted" aria-hidden="true">+</span>
                  <span className="text-sm font-medium">Agregar fotos</span>
                  <span className="text-[11px] leading-4 text-muted">Puedes elegir varias · hasta 12 MB cada una</span>
                  <input
                    type="file"
                    multiple
                    accept="image/jpeg,image/png,image/webp,image/gif,image/avif,.jpg,.jpeg,.png,.webp,.gif,.avif"
                    className="sr-only"
                    disabled={!!busy}
                    onChange={(event) => {
                      const files = Array.from(event.target.files ?? []);
                      event.target.value = "";
                      if (files.length) upload(files);
                    }}
                  />
                </label>
              </li>
            ) : null}
          </ul>

          <p className="mt-2 text-xs text-muted">
            {extra < MAX_SLIDES ? `Puedes sumar ${MAX_SLIDES - extra} ${MAX_SLIDES - extra === 1 ? "foto más" : "fotos más"}.` : `Llegaste al máximo de ${MAX_SLIDES} fotos además de la principal.`}
          </p>

          {busy ? (
            <p className="mt-3 flex items-center gap-2 rounded-xl bg-paper px-3 py-2 text-sm" role="status">
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-ink/20 border-t-ink" aria-hidden="true" />
              {busy}
            </p>
          ) : null}
          {notice ? (
            <p className={`mt-3 rounded-xl px-3 py-2 text-sm ${notice.tone === "ok" ? "bg-sage text-ink" : "bg-red-50 text-red-800"}`} role={notice.tone === "error" ? "alert" : "status"}>
              {notice.text}
            </p>
          ) : null}

          {framing && photos[framing.index + 1] ? (
            <div className={`mt-5 grid gap-5 rounded-2xl border border-line bg-white p-4 ${compact ? "" : "md:grid-cols-[minmax(0,320px)_1fr]"}`}>
              <ImageComposer
                src={photos[framing.index + 1].src}
                kind="image"
                fit={normalizeFit(slot.asset.fit)}
                ratioCss={ratioCss}
                posX={framing.posX}
                posY={framing.posY}
                zoom={framing.zoom}
                radius={normalizeRadius(slot.asset.radius)}
                feather={normalizeFeather(slot.asset.feather)}
                onMove={(posX, posY) => setFraming((current) => (current ? { ...current, posX, posY } : current))}
                onZoom={(zoom) => setFraming((current) => (current ? { ...current, zoom } : current))}
              />
              <div className="min-w-0">
                <p className="text-sm font-medium">Encuadre de la foto {framing.index + 2}</p>
                <p className="mt-1 text-xs leading-5 text-muted">Arrastra la foto para elegir qué se ve y usa el zoom si hace falta.</p>
                <label className="mt-4 block text-sm">
                  Texto alternativo
                  <input
                    value={framing.alt}
                    maxLength={160}
                    placeholder={slot.asset.alt || "Describe la foto"}
                    className={field}
                    onChange={(event) => setFraming({ ...framing, alt: event.target.value })}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") event.preventDefault();
                    }}
                  />
                </label>
                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    disabled={!!busy}
                    className="rounded-full bg-accent px-5 py-2.5 text-sm text-white disabled:opacity-60"
                    onClick={() =>
                      run("Guardando encuadre…", { intent: "frame", index: String(framing.index), alt: framing.alt, posX: String(framing.posX), posY: String(framing.posY), zoom: String(framing.zoom) }, "Encuadre guardado.")
                    }
                  >
                    Guardar encuadre
                  </button>
                  <button type="button" className="text-sm text-muted underline-offset-4 hover:underline" onClick={() => setFraming({ ...framing, posX: 50, posY: 50, zoom: 100 })}>
                    Centrar de nuevo
                  </button>
                  <button type="button" className="text-sm text-muted underline-offset-4 hover:underline" onClick={() => setFraming(null)}>
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
