import { usePage } from "@inertiajs/react";
import { useActionState, useState } from "react";
import { deleteDevotional, saveDevotional, type ActionResult } from "@/lib/actions";
import AdminLayout from "@/Layouts/AdminLayout";
import type { DevotionalFull } from "@/lib/types";
import { formatSermonDate } from "@/lib/youtube";

const field = "mt-1 w-full rounded-xl border border-line bg-white px-3 py-2";

export default function Devocionales({ devotionals, today }: { devotionals: DevotionalFull[]; today: string }) {
  const [creating, setCreating] = useState(false);
  const { entrance } = usePage().props as unknown as { entrance?: { siteUrl?: string } };
  const site = (entrance?.siteUrl || "").replace(/\/$/, "");
  const scheduled = devotionals.filter((item) => item.publish_on > today).sort((a, b) => a.publish_on.localeCompare(b.publish_on));
  const published = devotionals.filter((item) => item.publish_on <= today);

  return (
    <AdminLayout>
      <h1 className="display text-4xl">Devocionales</h1>
      <p className="mt-2 max-w-2xl text-muted">
        Escribe devocionales para que la iglesia los lea durante la semana. Puedes programarlos: si eliges una fecha futura, aparecen solos en la web ese día. El más reciente se destaca en /devocionales.
      </p>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        {creating ? null : (
          <button type="button" onClick={() => setCreating(true)} className="rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-white">
            + Nuevo devocional
          </button>
        )}
        <a href={`${site}/devocionales`} target="_blank" rel="noreferrer" className="rounded-full border border-line bg-white px-5 py-2.5 text-sm">
          Ver devocionales en la web ↗
        </a>
      </div>
      {creating ? (
        <div className="mt-6">
          <DevotionalForm today={today} site={site} onDone={() => setCreating(false)} />
        </div>
      ) : null}

      {scheduled.length ? (
        <>
          <h2 className="mt-10 text-sm font-semibold uppercase tracking-[0.18em] text-muted">Programados ({scheduled.length})</h2>
          <div className="mt-4 grid gap-6">
            {scheduled.map((item) => <DevotionalForm key={item.id} devotional={item} today={today} site={site} />)}
          </div>
        </>
      ) : null}

      <h2 className="mt-10 text-sm font-semibold uppercase tracking-[0.18em] text-muted">Publicados ({published.length})</h2>
      {published.length ? (
        <div className="mt-4 grid gap-6">
          {published.map((item) => <DevotionalForm key={item.id} devotional={item} today={today} site={site} />)}
        </div>
      ) : (
        <p className="mt-4 rounded-2xl border border-dashed border-line px-5 py-6 text-sm text-muted">Aún no hay devocionales publicados. La página de devocionales mostrará un mensaje de “pronto” mientras tanto.</p>
      )}
    </AdminLayout>
  );
}

function DevotionalForm({ devotional, today, site, onDone }: { devotional?: DevotionalFull; today: string; site: string; onDone?: () => void }) {
  const [state, action, pending] = useActionState(async (_: ActionResult | undefined, formData: FormData) => {
    const result = await saveDevotional(formData);
    if (result?.ok) {
      setPreview(null);
      onDone?.();
    }
    return result;
  }, undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const image = preview || devotional?.image || null;
  const status = !devotional
    ? null
    : !devotional.active
      ? "Oculto"
      : devotional.publish_on > today
        ? `Programado para el ${formatSermonDate(devotional.publish_on)}`
        : `Publicado el ${formatSermonDate(devotional.publish_on)}`;

  async function remove() {
    if (!devotional || !window.confirm(`¿Eliminar el devocional «${devotional.title}»? Ya no aparecerá en la web.`)) return;
    setBusy(true);
    setError("");
    const result = await deleteDevotional(devotional.id);
    if (result?.error) setError(result.error);
    setBusy(false);
  }

  return (
    <form action={action} className="grid gap-5 rounded-[1.5rem] border border-line bg-card p-5 md:grid-cols-[220px_1fr]">
      <input type="hidden" name="id" value={devotional?.id || ""} />
      <div>
        <div className="flex aspect-[4/3] w-full max-w-[220px] items-center justify-center overflow-hidden rounded-2xl border border-line bg-stone md:max-w-none">
          {image ? (
            <img src={image} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="px-4 text-center text-xs text-muted">Sin imagen propia. Se mostrará la portada de Devocionales (Imágenes y videos).</span>
          )}
        </div>
        <label className="mt-3 block text-sm">
          {devotional?.image ? "Cambiar imagen" : "Imagen (opcional)"}
          <input
            name="image"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => {
              const file = e.target.files?.[0];
              setPreview(file ? URL.createObjectURL(file) : null);
            }}
            className="mt-1 block w-full text-xs"
          />
        </label>
        <p className="mt-1 text-[11px] leading-4 text-muted">JPG, PNG o WEBP hasta 8 MB. Ideal horizontal.</p>
        {devotional?.image ? (
          <label className="mt-2 block text-xs text-muted"><input type="checkbox" name="remove_image" /> Quitar imagen</label>
        ) : null}
      </div>

      <div className="grid content-start gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-medium tracking-[-0.02em]">{devotional ? devotional.title : "Nuevo devocional"}</h3>
            {status ? <p className="text-xs text-muted">{status} · {devotional?.minutes} min de lectura</p> : null}
          </div>
          {devotional ? (
            <div className="flex gap-2">
              {devotional.active && devotional.publish_on <= today ? (
                <a href={`${site}/devocionales/${devotional.slug}`} target="_blank" rel="noreferrer" className="rounded-full border border-line bg-white px-3 py-1.5 text-sm">
                  Ver ↗
                </a>
              ) : null}
              <button type="button" disabled={busy} onClick={remove} className="rounded-full border border-red-200 bg-white px-3 py-1.5 text-sm text-red-700 disabled:opacity-40">
                Eliminar
              </button>
            </div>
          ) : null}
        </div>
        <label className="text-sm">Título<input name="title" required maxLength={160} defaultValue={devotional?.title} placeholder="Ej. Cuando Dios guarda silencio" className={field} /></label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">Fecha de publicación<input name="publish_on" type="date" required defaultValue={devotional?.publish_on || today} className={field} /></label>
          <label className="text-sm">Autor <span className="text-muted">(opcional)</span><input name="author" maxLength={100} defaultValue={devotional?.author || ""} placeholder="Ej. Pastor Juan Pérez" className={field} /></label>
        </div>
        <div className="grid gap-3 sm:grid-cols-[1fr_2fr]">
          <label className="text-sm">Cita bíblica<input name="verse_ref" maxLength={80} defaultValue={devotional?.verse_ref || ""} placeholder="Ej. Salmo 46:10" className={field} /></label>
          <label className="text-sm">Versículo<input name="verse_text" maxLength={600} defaultValue={devotional?.verse_text || ""} placeholder="Estad quietos, y conoced que yo soy Dios…" className={field} /></label>
        </div>
        <label className="text-sm">
          Devocional
          <textarea name="body" required minLength={40} maxLength={20000} rows={devotional ? 8 : 12} defaultValue={devotional?.body || ""} placeholder="Escribe el devocional. Deja una línea en blanco entre párrafos." className={`${field} leading-relaxed`} />
        </label>
        <p className="-mt-1 text-[11px] text-muted">Deja una línea en blanco entre párrafos para que se lea cómodo en el celular.</p>
        <label className="text-sm"><input type="checkbox" name="active" defaultChecked={devotional ? devotional.active : true} /> Visible en la web</label>
        {(state?.error || error) && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{state?.error || error}</p>}
        {state?.ok && devotional && <p className="rounded-xl bg-sage px-3 py-2 text-sm">{state.message || "Guardado."}</p>}
        <div className="flex gap-3">
          <button disabled={pending} className="w-fit rounded-full bg-accent px-5 py-2 text-sm text-white disabled:opacity-60">
            {pending ? "Guardando…" : devotional ? "Guardar" : "Publicar devocional"}
          </button>
          {!devotional && onDone ? <button type="button" onClick={onDone} className="rounded-full border border-line bg-white px-5 py-2 text-sm">Cancelar</button> : null}
        </div>
      </div>
    </form>
  );
}
