
import { useActionState, useEffect, useState } from "react";
import { addGallerySlot, saveMediaAsset } from "@/lib/actions";
import { ImageComposer } from "@/Components/admin/image-composer";
import { clampFocus, galleryIndex, GALLERY_MAX, GALLERY_MIN, normalizeFeather, normalizeRadius, normalizeZoom, parseRatio, ratioPresets, fitPresets, normalizeFit, type MediaAsset, type MediaFit, type MediaKind } from "@/lib/media";

export type AdminMediaSlot = {
  id: string;
  group: string;
  label: string;
  hint: string;
  asset: MediaAsset;
  custom: boolean;
  followsHero?: boolean;
};

const field = "mt-1 w-full rounded-xl border border-line bg-white px-3 py-2";

export function MediaManager({ slots }: { slots: AdminMediaSlot[] }) {
  const groups = [...new Set(slots.map((slot) => slot.group))];
  const galleryCount = slots.filter((slot) => galleryIndex(slot.id) > 0).length;
  return (
    <div className="space-y-12">
      {groups.map((group) => (
        <section key={group}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-orange-deep">{group}</p>
          {group === "Carrusel del inicio" && (
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
              Mínimo {GALLERY_MIN} fotos. En la web se ven 5; al menos una queda fuera y entra cuando cambia la imagen del centro.
            </p>
          )}
          <div className="mt-4 grid gap-5">
            {slots.filter((slot) => slot.group === group).map((slot) => (
              <MediaSlotCard key={slot.id} slot={slot} removable={galleryIndex(slot.id) > GALLERY_MIN} />
            ))}
          </div>
          {group === "Carrusel del inicio" && galleryCount < GALLERY_MAX && (
            <form
              action={async () => {
                await addGallerySlot();
              }}
              className="mt-4"
            >
              <button className="rounded-full border border-line bg-white px-5 py-2.5 text-sm font-medium">
                Añadir foto al carrusel
              </button>
            </form>
          )}
        </section>
      ))}
    </div>
  );
}

function MediaSlotCard({ slot, removable = false }: { slot: AdminMediaSlot; removable?: boolean }) {
  const [state, action, pending] = useActionState(async (_: unknown, formData: FormData) => saveMediaAsset(formData), undefined);
  const initialRatio = parseRatio(slot.asset.ratio);
  const [kind, setKind] = useState<MediaKind>(slot.asset.kind);
  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [ratio, setRatio] = useState(initialRatio.preset);
  const [ratioWidth, setRatioWidth] = useState(String(initialRatio.width));
  const [ratioHeight, setRatioHeight] = useState(String(initialRatio.height));
  const [fit, setFit] = useState<MediaFit>(normalizeFit(slot.asset.fit));
  const [posX, setPosX] = useState(clampFocus(slot.asset.posX));
  const [posY, setPosY] = useState(clampFocus(slot.asset.posY));
  const [zoom, setZoom] = useState(normalizeZoom(slot.asset.zoom));
  const [radius, setRadius] = useState(normalizeRadius(slot.asset.radius));
  const [featherOn, setFeatherOn] = useState(normalizeFeather(slot.asset.feather) > 0);
  const [feather, setFeather] = useState(normalizeFeather(slot.asset.feather) || 16);

  useEffect(() => {
    const next = parseRatio(slot.asset.ratio);
    setKind(slot.asset.kind);
    setPreview(null);
    setFileName("");
    setRatio(next.preset);
    setRatioWidth(String(next.width));
    setRatioHeight(String(next.height));
    setFit(normalizeFit(slot.asset.fit));
    setPosX(clampFocus(slot.asset.posX));
    setPosY(clampFocus(slot.asset.posY));
    setZoom(normalizeZoom(slot.asset.zoom));
    setRadius(normalizeRadius(slot.asset.radius));
    setFeatherOn(normalizeFeather(slot.asset.feather) > 0);
    setFeather(normalizeFeather(slot.asset.feather) || 16);
  }, [slot.asset.kind, slot.asset.src, slot.asset.poster, slot.asset.alt, slot.asset.ratio, slot.asset.fit, slot.asset.posX, slot.asset.posY, slot.asset.zoom, slot.asset.radius, slot.asset.feather, slot.custom]);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const shown = preview || slot.asset.src;
  const shownKind: MediaKind = preview ? kind : slot.asset.kind;
  const previewRatio = parseRatio(ratio === "custom" ? `${ratioWidth}/${ratioHeight}` : ratio);

  return (
    <form action={action} className="grid gap-5 rounded-[1.6rem] border border-line bg-card p-4 md:grid-cols-[minmax(0,340px)_1fr] md:p-5">
      <input type="hidden" name="id" value={slot.id} />
      <input type="hidden" name="posX" value={posX} />
      <input type="hidden" name="posY" value={posY} />
      <input type="hidden" name="zoom" value={zoom} />
      <div>
        <ImageComposer
          src={shown}
          kind={shownKind}
          poster={preview ? undefined : slot.asset.poster}
          fit={fit}
          ratioCss={previewRatio.css || "4 / 5"}
          posX={posX}
          posY={posY}
          zoom={zoom}
          radius={radius}
          feather={featherOn ? feather : 0}
          onMove={(x, y) => {
            setPosX(x);
            setPosY(y);
          }}
          onZoom={setZoom}
        />
        <button
          type="button"
          className="mt-2 text-xs text-muted underline-offset-4 hover:underline"
          onClick={() => {
            setPosX(50);
            setPosY(28);
            setZoom(100);
          }}
        >
          Centrar de nuevo
        </button>
        <p className="px-3 py-2 text-[11px] uppercase tracking-[0.16em] text-muted">
          {slot.followsHero ? "Usa la portada del inicio" : slot.custom ? "Archivo publicado" : "Archivo original"}
        </p>
      </div>

      <div className="min-w-0">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-medium tracking-[-0.03em]">{slot.label}</h2>
            <p className="mt-1 max-w-xl text-sm leading-6 text-muted">{slot.hint}</p>
          </div>
        </div>

        {state && "ok" in state && state.ok && (
          <p className="mt-4 rounded-xl bg-sage px-3 py-2 text-sm text-ink">Publicado en el sitio.</p>
        )}
        {state && "error" in state && state.error && (
          <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">{state.error}</p>
        )}

        <fieldset className="mt-4">
          <legend className="text-sm">Qué quieres subir</legend>
          <div className="mt-2 flex w-fit rounded-full bg-sage p-1">
            {(["image", "video"] as const).map((option) => (
              <label key={option} className="cursor-pointer">
                <input
                  type="radio"
                  name="kind"
                  value={option}
                  checked={kind === option}
                  onChange={() => {
                    setKind(option);
                    setPreview(null);
                    setFileName("");
                  }}
                  className="peer sr-only"
                />
                <span className="block rounded-full px-4 py-1.5 text-sm text-muted peer-checked:bg-white peer-checked:text-ink peer-checked:shadow-sm">
                  {option === "image" ? "Imagen" : "Video"}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <label className="mt-4 block text-sm">
          {kind === "video" ? "Video MP4 o WebM, hasta 60 MB" : "Imagen JPG, PNG, WebP o GIF, hasta 12 MB"}
          <input
            key={`${slot.asset.src}-${kind}`}
            name="file"
            type="file"
            accept={kind === "video" ? "video/mp4,video/webm,.mp4,.webm" : "image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif"}
            className={`${field} text-sm file:mr-3 file:rounded-full file:border-0 file:bg-ink file:px-3 file:py-1.5 file:text-xs file:text-white`}
            onChange={(event) => {
              const file = event.target.files?.[0];
              setFileName(file?.name || "");
              setPreview((current) => {
                if (current) URL.revokeObjectURL(current);
                return file ? URL.createObjectURL(file) : null;
              });
            }}
          />
        </label>
        {fileName && <p className="mt-1 truncate text-xs text-muted">{fileName}</p>}

        {kind === "video" && (
          <label className="mt-4 block text-sm">
            Imagen de portada, opcional
            <input
              name="poster"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif"
              className={`${field} text-sm file:mr-3 file:rounded-full file:border-0 file:bg-sage file:px-3 file:py-1.5 file:text-xs`}
            />
          </label>
        )}

        <label className="mt-4 block text-sm">
          Texto alternativo
          <input name="alt" defaultValue={slot.asset.alt} maxLength={160} className={field} />
        </label>

        <fieldset className="mt-4">
          <legend className="text-sm">Cómo se muestra</legend>
          <p className="mt-1 text-xs leading-5 text-muted">Llenar el recuadro y luego arrastrar la foto es lo más profesional.</p>
          <div className="mt-2 grid gap-2">
            {fitPresets.map((preset) => (
              <label key={preset.id} className="flex cursor-pointer items-start gap-2 rounded-xl border border-line px-3 py-2 has-[:checked]:border-ink/30 has-[:checked]:bg-paper">
                <input
                  type="radio"
                  name="fit"
                  value={preset.id}
                  checked={fit === preset.id}
                  onChange={() => setFit(preset.id)}
                  className="mt-1"
                />
                <span>
                  <span className="block text-sm font-medium">{preset.label}</span>
                  <span className="block text-xs leading-5 text-muted">{preset.hint}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="mt-4">
          <legend className="text-sm">Bordes</legend>
          <p className="mt-1 text-xs leading-5 text-muted">Por defecto la foto es redondeada y sin bifuminado.</p>
          <label className="mt-3 block text-sm">
            Radio de las esquinas
            <input type="range" min={0} max={80} value={radius} onChange={(event) => setRadius(Number(event.target.value))} className="mt-1 w-full accent-ink" />
            <span className="mt-1 block text-xs text-muted">{radius} px</span>
          </label>
          <input type="hidden" name="radius" value={radius} />
          <label className="mt-3 flex items-start gap-2 text-sm">
            <input type="checkbox" name="featherOn" checked={featherOn} onChange={(event) => setFeatherOn(event.target.checked)} className="mt-1" />
            <span>
              <span className="block font-medium">Bifuminar los bordes</span>
              <span className="block text-xs leading-5 text-muted">Opcional. Si no lo marcas, la foto queda nítida.</span>
            </span>
          </label>
          {featherOn && (
            <label className="mt-3 block text-sm">
              Intensidad del bifuminado
              <input name="feather" type="range" min={8} max={40} value={feather} onChange={(event) => setFeather(Number(event.target.value))} className="mt-1 w-full accent-ink" />
              <span className="mt-1 block text-xs text-muted">{feather}%</span>
            </label>
          )}
        </fieldset>

        <fieldset className="mt-4">
          <legend className="text-sm">Relación de aspecto, ancho y alto</legend>
          <p className="mt-1 text-xs leading-5 text-muted">Si eliges llenar el recuadro, esta proporción define el tamaño. Vertical 4:5 queda bien al lado del texto.</p>
          <select
            name="ratio"
            value={ratio}
            onChange={(event) => setRatio(event.target.value)}
            className={field}
          >
            {ratioPresets.map((preset) => (
              <option key={preset.id} value={preset.id}>{preset.label}</option>
            ))}
          </select>
          {ratio === "custom" && (
            <div className="mt-3 grid grid-cols-2 gap-3">
              <label className="text-sm">Ancho
                <input name="ratioWidth" type="number" min={1} max={32} value={ratioWidth} onChange={(event) => setRatioWidth(event.target.value)} className={field} />
              </label>
              <label className="text-sm">Alto
                <input name="ratioHeight" type="number" min={1} max={32} value={ratioHeight} onChange={(event) => setRatioHeight(event.target.value)} className={field} />
              </label>
            </div>
          )}
        </fieldset>

        <div className="mt-5 flex flex-wrap items-center gap-4">
          <button disabled={pending} name="intent" value="save" className="rounded-full bg-accent px-5 py-2.5 text-sm text-white disabled:opacity-60">
            {pending ? "Publicando…" : "Publicar"}
          </button>
          {slot.custom && !removable && (
            <button
              name="intent"
              value="restore"
              className="text-sm text-muted underline-offset-4 hover:underline"
              onClick={(event) => {
                if (!window.confirm("¿Volver al archivo original de esta sección?")) event.preventDefault();
              }}
            >
              Restaurar original
            </button>
          )}
          {removable && (
            <button
              name="intent"
              value="remove-gallery"
              className="text-sm text-muted underline-offset-4 hover:underline"
              onClick={(event) => {
                if (!window.confirm("¿Quitar esta foto del carrusel?")) event.preventDefault();
              }}
            >
              Quitar del carrusel
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
