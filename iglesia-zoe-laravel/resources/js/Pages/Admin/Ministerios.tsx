import { useActionState, useState } from "react";
import { deleteMinistry, moveMinistry, saveMinistry, type ActionResult } from "@/lib/actions";
import AdminLayout from "@/Layouts/AdminLayout";
import type { Ministry } from "@/lib/types";

const field = "mt-1 w-full rounded-xl border border-line bg-white px-3 py-2";

export default function Ministerios({ ministries }: { ministries: Ministry[] }) {
  const [creating, setCreating] = useState(false);
  return (
    <AdminLayout>
      <h1 className="display text-4xl">Ministerios</h1>
      <p className="mt-2 max-w-2xl text-muted">
        Crea, ordena y edita los ministerios que aparecen en la web. La foto o el video de cada ministerio se publica en Medios.
      </p>
      <div className="mt-6">
        {creating ? (
          <MinistryForm onDone={() => setCreating(false)} />
        ) : (
          <button type="button" onClick={() => setCreating(true)} className="rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-white">
            + Nuevo ministerio
          </button>
        )}
      </div>
      <div className="mt-8 grid gap-8">
        {ministries.map((ministry, index) => (
          <MinistryForm
            key={ministry.id || ministry.slug}
            ministry={ministry}
            first={index === 0}
            last={index === ministries.length - 1}
          />
        ))}
      </div>
    </AdminLayout>
  );
}

function MinistryForm({ ministry, first, last, onDone }: { ministry?: Ministry; first?: boolean; last?: boolean; onDone?: () => void }) {
  const [state, action, pending] = useActionState(async (_: ActionResult | undefined, formData: FormData) => {
    const result = await saveMinistry(formData);
    if (result?.ok) onDone?.();
    return result;
  }, undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const id = ministry?.id || "";

  const run = async (task: () => Promise<ActionResult>) => {
    setBusy(true);
    setError("");
    const result = await task();
    if (result?.error) setError(result.error);
    setBusy(false);
  };

  return (
    <form action={action} className="grid gap-3 rounded-[1.5rem] border border-line bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-medium tracking-[-0.02em]">{ministry ? ministry.name : "Nuevo ministerio"}</h2>
        {ministry && id && (
          <div className="flex gap-2 text-sm">
            <button type="button" disabled={busy || first} onClick={() => run(() => moveMinistry(id, "up"))} className="rounded-full border border-line bg-white px-3 py-1.5 disabled:opacity-40" aria-label="Subir">↑ Subir</button>
            <button type="button" disabled={busy || last} onClick={() => run(() => moveMinistry(id, "down"))} className="rounded-full border border-line bg-white px-3 py-1.5 disabled:opacity-40" aria-label="Bajar">↓ Bajar</button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (window.confirm(`¿Eliminar el ministerio «${ministry.name}»? Ya no aparecerá en la web.`)) run(() => deleteMinistry(id));
              }}
              className="rounded-full border border-red-200 bg-white px-3 py-1.5 text-red-700 disabled:opacity-40"
            >
              Eliminar
            </button>
          </div>
        )}
      </div>
      <input type="hidden" name="id" value={id} />
      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-sm">Nombre<input name="name" required defaultValue={ministry?.name} className={field} /></label>
        <label className="text-sm">Dirección web
          <input name="slug" defaultValue={ministry?.slug} placeholder="se genera del nombre" className={field} />
          <span className="mt-1 block text-xs text-muted">Aparece como /ministerios/{ministry?.slug || "nombre"}. Solo letras, números y guiones.</span>
        </label>
        <label className="text-sm">Edades<input name="age_range" defaultValue={ministry?.age_range} className={field} /></label>
        <label className="text-sm">Color de acento<input name="accent" type="color" defaultValue={ministry?.accent || "#e8c3a4"} className="mt-1 h-11 w-full rounded-xl border border-line bg-white px-2" /></label>
      </div>
      <label className="text-sm">Resumen<input name="summary" defaultValue={ministry?.summary} className={field} /></label>
      <label className="text-sm">Texto<textarea name="body" defaultValue={ministry?.body} rows={4} className={field} /></label>
      <label className="text-sm"><input type="checkbox" name="active" defaultChecked={ministry ? ministry.active !== false : true} /> Visible</label>
      {(state?.error || error) && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{state?.error || error}</p>}
      {state?.ok && ministry && <p className="rounded-xl bg-sage px-3 py-2 text-sm">Guardado.</p>}
      <div className="flex gap-3">
        <button disabled={pending} className="w-fit rounded-full bg-accent px-5 py-2 text-sm text-white disabled:opacity-60">{pending ? "Guardando…" : ministry ? "Guardar" : "Crear ministerio"}</button>
        {!ministry && onDone && <button type="button" onClick={onDone} className="rounded-full border border-line bg-white px-5 py-2 text-sm">Cancelar</button>}
      </div>
    </form>
  );
}
