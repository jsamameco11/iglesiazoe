import { useActionState, useState } from "react";
import { deleteTeaching, saveTeaching, type ActionResult } from "@/lib/actions";
import AdminLayout from "@/Layouts/AdminLayout";
import type { Teaching, TeachingKind } from "@/lib/types";

const field = "mt-1 w-full rounded-xl border border-line bg-white px-3 py-2";

const KINDS: { id: TeachingKind; label: string }[] = [
  { id: "predica", label: "Enseñanza de la prédica" },
  { id: "gc", label: "Enseñanza para los GC" },
];

export default function Recursos({ teachings, accept }: { teachings: Teaching[]; accept: string }) {
  const [creating, setCreating] = useState(false);
  const [filter, setFilter] = useState<TeachingKind | "all">("all");
  const shown = filter === "all" ? teachings : teachings.filter((item) => item.kind === filter);

  return (
    <AdminLayout>
      <h1 className="display text-4xl">Recursos y enseñanzas</h1>
      <p className="mt-2 max-w-2xl text-muted">
        Sube las enseñanzas de cada prédica y las de los grupos de conexión (GC). Se publican en /recursos para que la iglesia pueda verlas o descargarlas.
      </p>
      <div className="mt-6">
        {creating ? (
          <TeachingForm accept={accept} onDone={() => setCreating(false)} />
        ) : (
          <button type="button" onClick={() => setCreating(true)} className="rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-white">
            + Subir enseñanza
          </button>
        )}
      </div>

      <div className="mt-10 flex flex-wrap gap-2 text-sm">
        {[{ id: "all" as const, label: "Todas" }, ...KINDS].map((kind) => (
          <button
            key={kind.id}
            type="button"
            onClick={() => setFilter(kind.id)}
            className={`rounded-full border px-4 py-1.5 ${filter === kind.id ? "border-ink bg-ink text-paper" : "border-line bg-white"}`}
          >
            {kind.label} ({kind.id === "all" ? teachings.length : teachings.filter((item) => item.kind === kind.id).length})
          </button>
        ))}
      </div>

      {shown.length ? (
        <div className="mt-5 grid gap-5">
          {shown.map((teaching) => <TeachingForm key={teaching.id} teaching={teaching} accept={accept} />)}
        </div>
      ) : (
        <p className="mt-5 rounded-2xl border border-dashed border-line px-5 py-6 text-sm text-muted">Aún no hay enseñanzas en esta lista.</p>
      )}
    </AdminLayout>
  );
}

function TeachingForm({ teaching, accept, onDone }: { teaching?: Teaching; accept: string; onDone?: () => void }) {
  const [state, action, pending] = useActionState(async (_: ActionResult | undefined, formData: FormData) => {
    const result = await saveTeaching(formData);
    if (result?.ok) onDone?.();
    return result;
  }, undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Lima" });

  async function remove() {
    if (!teaching || !window.confirm(`¿Eliminar «${teaching.title}»? Ya no aparecerá en la web.`)) return;
    setBusy(true);
    setError("");
    const result = await deleteTeaching(teaching.id);
    if (result?.error) setError(result.error);
    setBusy(false);
  }

  return (
    <form action={action} className="grid gap-3 rounded-[1.5rem] border border-line bg-card p-5">
      <input type="hidden" name="id" value={teaching?.id || ""} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {teaching?.file_type ? <span className="rounded-lg bg-ink px-2 py-1 text-[10px] font-semibold tracking-[0.12em] text-paper">{teaching.file_type}</span> : null}
          <h2 className="text-lg font-medium tracking-[-0.02em]">{teaching ? teaching.title : "Nueva enseñanza"}</h2>
          {teaching && !teaching.active ? <span className="text-xs text-muted">· oculta</span> : null}
        </div>
        {teaching ? (
          <div className="flex gap-2 text-sm">
            {teaching.file_url ? <a href={teaching.file_url} target="_blank" rel="noreferrer" className="rounded-full border border-line bg-white px-3 py-1.5">Ver archivo</a> : null}
            <button type="button" disabled={busy} onClick={remove} className="rounded-full border border-red-200 bg-white px-3 py-1.5 text-red-700 disabled:opacity-40">Eliminar</button>
          </div>
        ) : null}
      </div>
      <div className="grid gap-3 md:grid-cols-[2fr_1fr_1fr]">
        <label className="text-sm">Título<input name="title" required maxLength={160} defaultValue={teaching?.title} placeholder="Ej. El poder de la gratitud" className={field} /></label>
        <label className="text-sm">Tipo
          <select name="kind" defaultValue={teaching?.kind || "predica"} className={field}>
            {KINDS.map((kind) => <option key={kind.id} value={kind.id}>{kind.label}</option>)}
          </select>
        </label>
        <label className="text-sm">Fecha<input name="teaching_date" type="date" required defaultValue={teaching?.teaching_date || today} className={field} /></label>
      </div>
      <label className="text-sm">Descripción <span className="text-muted">(opcional)</span><textarea name="summary" maxLength={400} rows={2} defaultValue={teaching?.summary || ""} className={field} /></label>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-sm">
          {teaching?.file_url ? "Reemplazar archivo" : "Archivo"}
          <input name="file" type="file" accept={accept} className="mt-1 block w-full rounded-xl border border-dashed border-line bg-white px-3 py-2 text-xs" />
          <span className="mt-1 block text-xs text-muted">PDF, Word, PowerPoint o imagen, hasta 25 MB.</span>
        </label>
        <label className="text-sm">Video de YouTube <span className="text-muted">(opcional)</span>
          <input name="youtube" defaultValue={teaching?.youtube_id ? `https://youtu.be/${teaching.youtube_id}` : ""} placeholder="Pega el enlace del video" className={field} />
        </label>
      </div>
      <label className="text-sm"><input type="checkbox" name="active" defaultChecked={teaching ? teaching.active : true} /> Visible en la web</label>
      {(state?.error || error) && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{state?.error || error}</p>}
      {state?.ok && teaching && <p className="rounded-xl bg-sage px-3 py-2 text-sm">{state.message || "Guardado."}</p>}
      <div className="flex gap-3">
        <button disabled={pending} className="w-fit rounded-full bg-accent px-5 py-2 text-sm text-white disabled:opacity-60">
          {pending ? "Subiendo…" : teaching ? "Guardar" : "Publicar enseñanza"}
        </button>
        {!teaching && onDone ? <button type="button" onClick={onDone} className="rounded-full border border-line bg-white px-5 py-2 text-sm">Cancelar</button> : null}
      </div>
    </form>
  );
}
