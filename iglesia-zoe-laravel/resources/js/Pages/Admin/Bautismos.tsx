import { Link } from "@inertiajs/react";
import { can, usePanelUser } from "@/lib/access";
import { saveBaptismEvent } from "@/lib/actions";
import AdminLayout from "@/Layouts/AdminLayout";

type EventRow = { id: string; event_date: string | null; location: string | null; notes: string | null; active: boolean };

export default function Bautismos({ events, registrations }: { events: EventRow[]; registrations: number }) {
  const user = usePanelUser();
  return (
    <AdminLayout>
      <h1 className="display text-4xl">Bautismos</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
        La fecha que publiques aquí es la que se ve en la web. Los textos de esa página se editan en Contenido.
      </p>
      <form action={saveBaptismEvent} className="mt-6 grid gap-3 rounded-[1.5rem] border border-line bg-card p-5 md:grid-cols-2">
        <label className="text-sm">Fecha que se muestra en la web
          <input type="date" name="event_date" className="mt-1 w-full rounded-xl border border-line px-3 py-2" />
        </label>
        <label className="text-sm">Lugar
          <input name="location" placeholder="Iglesia Cristiana Zoe" className="mt-1 w-full rounded-xl border border-line px-3 py-2" />
        </label>
        <input name="notes" placeholder="Notas internas" className="rounded-xl border border-line px-3 py-2 md:col-span-2" />
        <label className="text-sm"><input type="checkbox" name="active" defaultChecked /> Activa</label>
        <button className="w-fit rounded-full bg-accent px-5 py-2 text-sm text-white">Publicar fecha</button>
      </form>
      <div className="mt-4 space-y-3">
        {events.map((event) => (
          <form key={event.id} action={saveBaptismEvent} className="grid gap-3 rounded-2xl border border-line bg-card p-4 md:grid-cols-4">
            <input type="hidden" name="id" value={event.id} />
            <input type="date" name="event_date" defaultValue={event.event_date || ""} className="rounded-xl border border-line px-3 py-2" />
            <input name="location" defaultValue={event.location || ""} className="rounded-xl border border-line px-3 py-2" />
            <input name="notes" defaultValue={event.notes || ""} className="rounded-xl border border-line px-3 py-2" />
            <label className="text-sm"><input type="checkbox" name="active" defaultChecked={event.active} /> Activa</label>
            <button className="w-fit rounded-full bg-accent px-4 py-2 text-sm text-white">Guardar</button>
          </form>
        ))}
      </div>
      <div className="mt-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-card px-5 py-4">
        <p className="text-sm">
          <strong className="font-semibold">{registrations}</strong> {registrations === 1 ? "persona inscrita" : "personas inscritas"} desde la web.
        </p>
        {can(user, "inbox.baptisms") && (
          <Link href="/admin/formularios/bautismos" className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white">Ver inscripciones</Link>
        )}
      </div>
    </AdminLayout>
  );
}
