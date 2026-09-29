import { saveBaptismEvent } from "@/app/actions/admin";
import { getSession } from "@/lib/session";

export default async function BaptismAdmin() {
  const { supabase } = await getSession();
  const [{ data: events }, { data: registrations }] = await Promise.all([
    supabase.from("baptism_events").select("*").order("event_date"),
    supabase.from("baptism_registrations").select("*").order("created_at", { ascending: false }).limit(100),
  ]);
  return (
    <div>
      <h1 className="display text-4xl">Bautismos</h1>
      <form action={saveBaptismEvent} className="mt-6 grid gap-3 rounded-[1.5rem] border border-line bg-card p-5 md:grid-cols-2">
        <input type="date" name="event_date" className="rounded-xl border border-line px-3 py-2" />
        <input name="location" placeholder="Lugar" className="rounded-xl border border-line px-3 py-2" />
        <input name="notes" placeholder="Notas" className="rounded-xl border border-line px-3 py-2 md:col-span-2" />
        <label className="text-sm"><input type="checkbox" name="active" defaultChecked /> Activa</label>
        <button className="w-fit rounded-full bg-ink px-5 py-2 text-sm text-white">Publicar fecha</button>
      </form>
      <div className="mt-4 space-y-3">
        {(events || []).map((event) => (
          <form key={event.id} action={saveBaptismEvent} className="grid gap-3 rounded-2xl border border-line bg-card p-4 md:grid-cols-4">
            <input type="hidden" name="id" value={event.id} />
            <input type="date" name="event_date" defaultValue={event.event_date || ""} className="rounded-xl border border-line px-3 py-2" />
            <input name="location" defaultValue={event.location || ""} className="rounded-xl border border-line px-3 py-2" />
            <input name="notes" defaultValue={event.notes || ""} className="rounded-xl border border-line px-3 py-2" />
            <label className="text-sm"><input type="checkbox" name="active" defaultChecked={event.active} /> Activa</label>
            <button className="w-fit rounded-full bg-ink px-4 py-2 text-sm text-white">Guardar</button>
          </form>
        ))}
      </div>
      <h2 className="mt-10 text-2xl font-light">Inscripciones</h2>
      <div className="mt-4 overflow-hidden rounded-2xl border border-line bg-card">
        <table className="w-full text-sm">
          <thead><tr className="text-left"><th className="px-4 py-3">Nombre</th><th className="px-4 py-3">Teléfono</th><th className="px-4 py-3">Correo</th><th className="px-4 py-3">Nota</th></tr></thead>
          <tbody>
            {(registrations || []).map((row) => (
              <tr key={row.id} className="border-t border-line"><td className="px-4 py-3">{row.full_name}</td><td className="px-4 py-3">{row.phone}</td><td className="px-4 py-3">{row.email}</td><td className="px-4 py-3">{row.notes}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
