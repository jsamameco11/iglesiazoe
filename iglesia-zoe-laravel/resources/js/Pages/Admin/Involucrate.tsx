import { Link, usePage } from "@inertiajs/react";
import { useActionState, useState } from "react";
import { deleteServeArea, moveServeArea, saveServeArea, type ActionResult } from "@/lib/actions";
import AdminLayout from "@/Layouts/AdminLayout";
import type { ServeArea } from "@/lib/types";

const field = "mt-1 w-full rounded-xl border border-line bg-white px-3 py-2";

type AdminArea = ServeArea & { registrations: number };

export default function Involucrate({ areas }: { areas: AdminArea[] }) {
  const [creating, setCreating] = useState(false);
  const { entrance } = usePage().props as unknown as { entrance?: { siteUrl?: string } };
  const site = (entrance?.siteUrl || "").replace(/\/$/, "");

  return (
    <AdminLayout>
      <h1 className="display text-4xl">Involúcrate · áreas de servicio</h1>
      <p className="mt-2 max-w-2xl text-muted">
        Cada área tiene su foto, su página propia y sus equipos (por ejemplo Visuales: Multimedia, Cámara, Redes, Transmisión, Luces y Switcher). Todas aparecen en el carrusel «Somos una iglesia que está en movimiento» del inicio, con su botón debajo de la foto. Las que reciben voluntarios aparecen además en el menú Involúcrate y en el formulario «Regístrate para servir». Las personas que se registran llegan a{" "}
        <Link href="/admin/formularios/servidores" className="underline underline-offset-4">Formularios → Quiero servir</Link>.
      </p>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        {creating ? null : (
          <button type="button" onClick={() => setCreating(true)} className="rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-white">
            + Nueva área
          </button>
        )}
        <a href={`${site}/involucrate`} target="_blank" rel="noreferrer" className="rounded-full border border-line bg-white px-5 py-2.5 text-sm">Ver Involúcrate en la web ↗</a>
      </div>
      {creating ? <div className="mt-6"><AreaForm site={site} onDone={() => setCreating(false)} /></div> : null}

      <div className="mt-8 grid gap-6">
        {areas.map((area, index) => (
          <AreaForm key={area.id} area={area} site={site} first={index === 0} last={index === areas.length - 1} />
        ))}
      </div>
      {!areas.length && !creating ? (
        <p className="mt-6 rounded-2xl border border-dashed border-line px-5 py-6 text-sm text-muted">Aún no hay áreas. Crea la primera para que aparezcan en la web.</p>
      ) : null}
    </AdminLayout>
  );
}

function AreaForm({ area, site, first, last, onDone }: { area?: AdminArea; site: string; first?: boolean; last?: boolean; onDone?: () => void }) {
  const [state, action, pending] = useActionState(async (_: ActionResult | undefined, formData: FormData) => {
    const result = await saveServeArea(formData);
    if (result?.ok) {
      setPreview(null);
      onDone?.();
    }
    return result;
  }, undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const image = preview || area?.image || null;

  async function run(task: () => Promise<ActionResult>) {
    setBusy(true);
    setError("");
    const result = await task();
    if (result?.error) setError(result.error);
    setBusy(false);
  }

  function remove() {
    if (!area || !window.confirm(`¿Eliminar el área «${area.name}»? Su página dejará de verse en la web. Los registros recibidos se conservan.`)) return;
    run(() => deleteServeArea(area.id));
  }

  return (
    <form action={action} className="grid gap-5 rounded-[1.5rem] border border-line bg-card p-5 md:grid-cols-[220px_1fr]">
      <input type="hidden" name="id" value={area?.id || ""} />
      <div>
        <div className="flex aspect-[9/8] w-full max-w-[220px] items-center justify-center overflow-hidden rounded-2xl border border-line bg-stone">
          {image ? <img src={image} alt="" className="h-full w-full object-cover" /> : <span className="px-4 text-center text-xs text-muted">Sin foto</span>}
        </div>
        <label className="mt-3 block text-sm">
          {area?.image ? "Cambiar foto" : "Foto del área"}
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
        <p className="mt-1 text-[11px] leading-4 text-muted">JPG, PNG o WEBP hasta 8 MB. Horizontal o cuadrada, con personas sirviendo.</p>
        {area ? (
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" disabled={busy || first} onClick={() => run(() => moveServeArea(area.id, "up"))} className="rounded-full border border-line bg-white px-3 py-1.5 text-xs disabled:opacity-40" aria-label="Subir">↑ Subir</button>
            <button type="button" disabled={busy || last} onClick={() => run(() => moveServeArea(area.id, "down"))} className="rounded-full border border-line bg-white px-3 py-1.5 text-xs disabled:opacity-40" aria-label="Bajar">↓ Bajar</button>
          </div>
        ) : null}
      </div>

      <div className="grid content-start gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-medium tracking-[-0.02em]">{area ? area.name : "Nueva área"}</h3>
            {area ? (
              <p className="text-xs text-muted">
                /involucrate/{area.slug}
                {area.active ? "" : " · oculta"}
                {" · "}
                <Link href="/admin/formularios/servidores" className="underline-offset-2 hover:underline">
                  {area.registrations} {area.registrations === 1 ? "registro" : "registros"}
                </Link>
              </p>
            ) : null}
          </div>
          {area ? (
            <div className="flex gap-2">
              <a href={`${site}/involucrate/${area.slug}`} target="_blank" rel="noreferrer" className="rounded-full border border-line bg-white px-3 py-1.5 text-sm">Ver página ↗</a>
              <button type="button" disabled={busy} onClick={remove} className="rounded-full border border-red-200 bg-white px-3 py-1.5 text-sm text-red-700 disabled:opacity-40">Eliminar</button>
            </div>
          ) : null}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">Nombre<input name="name" required maxLength={80} defaultValue={area?.name} placeholder="Ej. Atmósfera" className={field} /></label>
          <label className="text-sm">Frase bajo el botón<input name="tagline" maxLength={120} defaultValue={area?.tagline || ""} placeholder="Ej. Acompañando vidas, edificando fe" className={field} /></label>
        </div>
        <label className="text-sm">Resumen<input name="summary" maxLength={300} defaultValue={area?.summary || ""} placeholder="Una o dos frases que expliquen qué hace el área" className={field} /></label>
        <label className="text-sm">Descripción de la página<textarea name="body" maxLength={3000} rows={4} defaultValue={area?.body || ""} placeholder="Qué hace el equipo, a quién buscan, cómo se sirve… Deja una línea en blanco entre párrafos." className={field} /></label>
        <label className="text-sm">
          Equipos <span className="text-muted">(uno por línea)</span>
          <textarea name="teams" rows={3} maxLength={1200} defaultValue={(area?.teams ?? []).join("\n")} placeholder={"Ujieres\nVisuales\nMultimedia"} className={field} />
        </label>
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr]">
          <label className="text-sm">Dirección web<input name="slug" maxLength={80} defaultValue={area?.slug || ""} placeholder="Se crea sola con el nombre" className={field} /></label>
          <label className="text-sm">Botón extra <span className="text-muted">(opcional)</span><input name="cta_label" maxLength={40} defaultValue={area?.cta_label || ""} placeholder="Ej. Ver la ruta completa" className={field} /></label>
          <label className="text-sm">Enlace del botón<input name="cta_url" maxLength={500} defaultValue={area?.cta_url || ""} placeholder="/ruta-del-servidor o https://…" className={field} /></label>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <label className="text-sm"><input type="checkbox" name="active" defaultChecked={area ? area.active : true} /> Visible en la web</label>
          <label className="text-sm">
            <input type="checkbox" name="accepts_volunteers" defaultChecked={area ? area.accepts_volunteers : true} /> Recibe voluntarios
            <span className="text-muted"> (aparece en Involúcrate, en el menú y en el formulario «Regístrate para servir»)</span>
          </label>
        </div>
        {(state?.error || error) && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{state?.error || error}</p>}
        {state?.ok && area && <p className="rounded-xl bg-sage px-3 py-2 text-sm">{state.message || "Guardado."}</p>}
        <div className="flex gap-3">
          <button disabled={pending} className="w-fit rounded-full bg-accent px-5 py-2 text-sm text-white disabled:opacity-60">
            {pending ? "Guardando…" : area ? "Guardar" : "Crear área"}
          </button>
          {!area && onDone ? <button type="button" onClick={onDone} className="rounded-full border border-line bg-white px-5 py-2 text-sm">Cancelar</button> : null}
        </div>
      </div>
    </form>
  );
}
