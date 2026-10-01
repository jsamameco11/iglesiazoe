import { saveMinistry } from "@/lib/actions";
import AdminLayout from "@/Layouts/AdminLayout";
import type { Ministry } from "@/lib/types";

export default function Ministerios({ ministries }: { ministries: Ministry[] }) {
  return (
    <AdminLayout>
      <h1 className="display text-4xl">Ministerios</h1>
      <p className="mt-2 max-w-2xl text-muted">La foto o el video de cada ministerio se publica en Medios.</p>
      <div className="mt-8 grid gap-8">
        {ministries.map((ministry) => (
          <form key={ministry.id || ministry.slug} action={saveMinistry} className="grid gap-3 rounded-[1.5rem] border border-line bg-card p-5">
            <input type="hidden" name="id" value={ministry.id || ""} />
            <input type="hidden" name="slug" value={ministry.slug} />
            <input type="hidden" name="sort_order" value={ministry.sort_order} />
            <input type="hidden" name="accent" value={ministry.accent} />
            <label className="text-sm">Nombre<input name="name" defaultValue={ministry.name} className="mt-1 w-full rounded-xl border border-line px-3 py-2" /></label>
            <label className="text-sm">Edades<input name="age_range" defaultValue={ministry.age_range} className="mt-1 w-full rounded-xl border border-line px-3 py-2" /></label>
            <label className="text-sm">Resumen<input name="summary" defaultValue={ministry.summary} className="mt-1 w-full rounded-xl border border-line px-3 py-2" /></label>
            <label className="text-sm">Texto<textarea name="body" defaultValue={ministry.body} rows={4} className="mt-1 w-full rounded-xl border border-line px-3 py-2" /></label>
            <label className="text-sm"><input type="checkbox" name="active" defaultChecked={ministry.active !== false} /> Visible</label>
            <button className="w-fit rounded-full bg-accent px-5 py-2 text-sm text-white">Guardar</button>
          </form>
        ))}
      </div>
    </AdminLayout>
  );
}
