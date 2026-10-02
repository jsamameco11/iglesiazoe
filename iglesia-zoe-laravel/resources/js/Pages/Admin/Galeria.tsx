import { router } from "@inertiajs/react";
import { useActionState, useRef, useState } from "react";
import { deleteGallery, removeGalleryPhoto, saveGallery, setGalleryCover, uploadGalleryPhoto, type ActionResult } from "@/lib/actions";
import AdminLayout from "@/Layouts/AdminLayout";
import type { GalleryKind, ServiceGalleryFull } from "@/lib/types";
import { formatSermonDate } from "@/lib/youtube";
import { useSiteUrl } from "@/lib/access";

const field = "mt-1 w-full rounded-xl border border-line bg-white px-3 py-2";

const KINDS: { id: GalleryKind; label: string; title: string }[] = [
  { id: "dominical", label: "Culto dominical", title: "Culto dominical" },
  { id: "media-semana", label: "Culto de media semana", title: "Culto de media semana" },
  { id: "especial", label: "Servicio especial", title: "Servicio especial" },
];

const MAX_EDGE = 2000;

/** Downscales a photo in the browser so phone pictures upload fast; falls back to the original file. */
async function shrink(file: File): Promise<{ blob: Blob; name: string }> {
  const original = { blob: file as Blob, name: file.name };
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return original;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 1.5 * 1024 * 1024) return original;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    return blob ? { blob, name: file.name.replace(/\.[^.]+$/, "") + ".jpg" } : original;
  } catch {
    return original;
  }
}

export default function Galeria({ galleries, today, maxPhotos }: { galleries: ServiceGalleryFull[]; today: string; maxPhotos: number }) {
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<string | null>(galleries[0]?.id ?? null);
  const site = useSiteUrl();
  const total = galleries.reduce((sum, gallery) => sum + gallery.count, 0);

  return (
    <AdminLayout>
      <h1 className="display text-4xl">Galería de cultos</h1>
      <p className="mt-2 max-w-2xl text-muted">
        Crea un álbum por cada culto dominical, de media semana o servicio especial y sube sus fotos. Se publican en Recursos → Galería de cultos, ordenados del más reciente al más antiguo. La primera foto es la portada del álbum.
      </p>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        {creating ? null : (
          <button type="button" onClick={() => setCreating(true)} className="rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-white">
            + Nuevo álbum
          </button>
        )}
        <a href={`${site}/galeria`} target="_blank" rel="noreferrer" className="rounded-full border border-line bg-white px-5 py-2.5 text-sm">
          Ver la galería en la web ↗
        </a>
        <span className="text-sm text-muted">
          {galleries.length} álbumes · {total} fotos
        </span>
      </div>

      {creating ? (
        <div className="mt-6 rounded-[1.5rem] border border-line bg-card p-5">
          <h2 className="text-lg font-medium tracking-[-0.02em]">Nuevo álbum</h2>
          <AlbumForm
            today={today}
            onSaved={(id) => {
              setCreating(false);
              setOpenId(id);
              router.reload({ only: ["galleries"] });
            }}
            onCancel={() => setCreating(false)}
          />
        </div>
      ) : null}

      <div className="mt-8 grid gap-4">
        {galleries.map((gallery) => (
          <Album
            key={gallery.id}
            gallery={gallery}
            today={today}
            site={site}
            maxPhotos={maxPhotos}
            open={openId === gallery.id}
            onToggle={() => setOpenId(openId === gallery.id ? null : gallery.id)}
          />
        ))}
      </div>
      {!galleries.length && !creating ? (
        <p className="mt-6 rounded-2xl border border-dashed border-line px-5 py-6 text-sm text-muted">Aún no hay álbumes. Crea el primero con las fotos del último culto.</p>
      ) : null}
    </AdminLayout>
  );
}

function AlbumForm({ gallery, today, onSaved, onCancel }: { gallery?: ServiceGalleryFull; today: string; onSaved?: (id: string) => void; onCancel?: () => void }) {
  const [kind, setKind] = useState<GalleryKind>(gallery?.kind || "dominical");
  const [state, action, pending] = useActionState(async (_: ActionResult | undefined, formData: FormData) => {
    const result = await saveGallery(formData);
    if (result?.ok) {
      if (onSaved) onSaved(String(result.id));
      else router.reload({ only: ["galleries"] });
    }
    return result;
  }, undefined);

  return (
    <form action={action} className="mt-4 grid gap-3">
      <input type="hidden" name="id" value={gallery?.id || ""} />
      <div className="grid gap-3 md:grid-cols-[1fr_1fr_2fr]">
        <label className="text-sm">
          Tipo de culto
          <select name="kind" value={kind} onChange={(event) => setKind(event.target.value as GalleryKind)} className={field}>
            {KINDS.map((item) => (
              <option key={item.id} value={item.id}>{item.label}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">Fecha<input name="service_date" type="date" required defaultValue={gallery?.service_date || today} className={field} /></label>
        <label className="text-sm">
          Título <span className="text-muted">(opcional)</span>
          <input name="title" maxLength={160} defaultValue={gallery?.title || ""} placeholder={KINDS.find((item) => item.id === kind)?.title} className={field} />
        </label>
      </div>
      <label className="text-sm">
        Descripción <span className="text-muted">(opcional)</span>
        <input name="summary" maxLength={400} defaultValue={gallery?.summary || ""} placeholder="Ej. Celebramos la Santa Cena y bautizamos a 12 hermanos." className={field} />
      </label>
      <label className="text-sm"><input type="checkbox" name="active" defaultChecked={gallery ? gallery.active : true} /> Visible en la web</label>
      {state?.error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      {state?.ok && gallery && <p className="rounded-xl bg-sage px-3 py-2 text-sm">{state.message || "Guardado."}</p>}
      <div className="flex gap-3">
        <button disabled={pending} className="w-fit rounded-full bg-accent px-5 py-2 text-sm text-white disabled:opacity-60">
          {pending ? "Guardando…" : gallery ? "Guardar datos" : "Crear álbum y subir fotos"}
        </button>
        {onCancel ? <button type="button" onClick={onCancel} className="rounded-full border border-line bg-white px-5 py-2 text-sm">Cancelar</button> : null}
      </div>
    </form>
  );
}

function Album({
  gallery,
  today,
  site,
  maxPhotos,
  open,
  onToggle,
}: {
  gallery: ServiceGalleryFull;
  today: string;
  site: string;
  maxPhotos: number;
  open: boolean;
  onToggle: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const kind = KINDS.find((item) => item.id === gallery.kind)?.label;

  async function upload(files: File[]) {
    const room = maxPhotos - gallery.count;
    const queue = files.filter((file) => file.type.startsWith("image/")).slice(0, Math.max(0, room));
    if (!queue.length) {
      setErrors([room <= 0 ? `Este álbum ya tiene ${maxPhotos} fotos. Crea otro álbum para el resto.` : "Elige fotos JPG, PNG o WEBP."]);
      return;
    }
    const failed: string[] = [];
    setErrors([]);
    setProgress({ done: 0, total: queue.length });
    for (const [index, file] of queue.entries()) {
      const { blob, name } = await shrink(file);
      const result = await uploadGalleryPhoto(gallery.id, blob, name);
      if (result?.error) failed.push(`${file.name}: ${result.error}`);
      setProgress({ done: index + 1, total: queue.length });
    }
    if (files.length > queue.length) failed.push(`Solo se subieron ${queue.length} fotos: el álbum admite hasta ${maxPhotos}.`);
    setErrors(failed);
    setProgress(null);
    if (input.current) input.current.value = "";
    router.reload({ only: ["galleries"] });
  }

  async function run(task: () => Promise<ActionResult>) {
    setBusy(true);
    const result = await task();
    if (result?.error) setErrors([result.error]);
    setBusy(false);
  }

  return (
    <section className="rounded-[1.5rem] border border-line bg-card">
      <button type="button" onClick={onToggle} className="flex w-full items-center gap-4 p-4 text-left" aria-expanded={open}>
        <span className="h-16 w-20 shrink-0 overflow-hidden rounded-xl bg-stone">
          {gallery.photos[0] ? <img src={gallery.photos[0]} alt="" className="h-full w-full object-cover" /> : null}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-lg font-medium tracking-[-0.02em]">{gallery.title}</span>
          <span className="block text-xs text-muted">
            {kind} · {formatSermonDate(gallery.service_date)} · {gallery.count} fotos
            {gallery.active ? (gallery.count ? "" : " · aún no se ve en la web (sin fotos)") : " · oculto"}
          </span>
        </span>
        <span className={`text-xs transition ${open ? "rotate-180" : ""}`}>▼</span>
      </button>

      {open ? (
        <div className="grid gap-6 border-t border-line p-5">
          <div
            className={`rounded-2xl border-2 border-dashed px-5 py-8 text-center transition ${dragging ? "border-accent bg-amber" : "border-line bg-white"}`}
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              if (!progress) upload(Array.from(event.dataTransfer.files));
            }}
          >
            {progress ? (
              <div className="mx-auto max-w-sm">
                <p className="text-sm font-medium">Subiendo {progress.done} de {progress.total} fotos…</p>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-line">
                  <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
                </div>
                <p className="mt-2 text-xs text-muted">No cierres esta página hasta que termine.</p>
              </div>
            ) : (
              <>
                <p className="text-sm font-medium">Arrastra aquí las fotos del culto</p>
                <p className="mt-1 text-xs text-muted">o</p>
                <button type="button" onClick={() => input.current?.click()} className="mt-2 rounded-full bg-accent px-5 py-2 text-sm font-medium text-white">
                  Elegir fotos
                </button>
                <p className="mt-3 text-xs text-muted">
                  Puedes elegir muchas a la vez (JPG, PNG o WEBP). Se optimizan solas antes de subir. Hasta {maxPhotos} fotos por álbum.
                </p>
              </>
            )}
            <input
              ref={input}
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(event) => upload(Array.from(event.target.files || []))}
            />
          </div>
          {errors.length ? (
            <ul className="grid gap-1 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
              {errors.map((message) => <li key={message}>{message}</li>)}
            </ul>
          ) : null}

          {gallery.photos.length ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
              {gallery.photos.map((photo, index) => (
                <figure key={photo} className="group relative m-0 overflow-hidden rounded-xl border border-line bg-stone">
                  <img src={photo} alt="" loading="lazy" className="aspect-square w-full object-cover" />
                  {index === 0 ? <span className="absolute left-2 top-2 rounded-full bg-ink px-2 py-0.5 text-[10px] font-semibold text-paper">Portada</span> : null}
                  <figcaption className="absolute inset-x-0 bottom-0 flex justify-between gap-1 bg-gradient-to-t from-black/70 to-transparent p-2 opacity-100 transition md:opacity-0 md:group-hover:opacity-100">
                    {index > 0 ? (
                      <button type="button" disabled={busy} onClick={() => run(() => setGalleryCover(gallery.id, photo))} className="rounded-full bg-white/90 px-2 py-1 text-[11px] font-medium">
                        Portada
                      </button>
                    ) : <span />}
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => window.confirm("¿Quitar esta foto del álbum?") && run(() => removeGalleryPhoto(gallery.id, photo))}
                      className="rounded-full bg-white/90 px-2 py-1 text-[11px] font-medium text-red-700"
                    >
                      Quitar
                    </button>
                  </figcaption>
                </figure>
              ))}
            </div>
          ) : null}

          <details>
            <summary className="cursor-pointer text-sm font-medium">Editar datos del álbum</summary>
            <AlbumForm gallery={gallery} today={today} />
          </details>

          <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4 text-sm">
            {gallery.active && gallery.count ? (
              <a href={`${site}/galeria/${gallery.slug}`} target="_blank" rel="noreferrer" className="rounded-full border border-line bg-white px-4 py-2">
                Ver álbum en la web ↗
              </a>
            ) : null}
            <button
              type="button"
              disabled={busy}
              onClick={() => window.confirm(`¿Eliminar el álbum «${gallery.title}» y sus ${gallery.count} fotos? No se puede deshacer.`) && run(() => deleteGallery(gallery.id))}
              className="rounded-full border border-red-200 bg-white px-4 py-2 text-red-700 disabled:opacity-40"
            >
              Eliminar álbum
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
