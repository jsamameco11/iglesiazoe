import { saveBaptismEvent } from "@/lib/actions";
import { flagUrl } from "@/lib/geo";
import AdminLayout from "@/Layouts/AdminLayout";

type EventRow = { id: string; event_date: string | null; location: string | null; notes: string | null; active: boolean };
type Registration = {
  id: string;
  full_name: string;
  phone: string;
  email: string | null;
  sex: string | null;
  age: number | null;
  country_code: string | null;
  country: string | null;
  event_date: string | null;
  notes: string | null;
  created_at: string | null;
};

function shortDate(value: string | null) {
  if (!value) return "—";
  return new Date(value + "T12:00:00").toLocaleDateString("es-PE", { day: "numeric", month: "short", year: "numeric" });
}

export default function Bautismos({ events, registrations }: { events: EventRow[]; registrations: Registration[] }) {
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
      <h2 className="mt-10 text-2xl font-light">Inscripciones</h2>
      <div className="mt-4 overflow-x-auto rounded-2xl border border-line bg-card">
        <table className="w-full min-w-[56rem] text-sm">
          <thead>
            <tr className="text-left">
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">Sexo</th>
              <th className="px-4 py-3">Edad</th>
              <th className="px-4 py-3">País</th>
              <th className="px-4 py-3">Teléfono</th>
              <th className="px-4 py-3">Correo</th>
              <th className="px-4 py-3">Fecha elegida</th>
              <th className="px-4 py-3">Nota</th>
              <th className="px-4 py-3">Recibido</th>
            </tr>
          </thead>
          <tbody>
            {registrations.map((row) => (
              <tr key={row.id} className="border-t border-line align-top">
                <td className="px-4 py-3 font-medium">{row.full_name}</td>
                <td className="px-4 py-3">{row.sex || "—"}</td>
                <td className="px-4 py-3">{row.age ?? "—"}</td>
                <td className="px-4 py-3">
                  {row.country_code ? (
                    <span className="inline-flex items-center gap-2 whitespace-nowrap">
                      <img src={flagUrl(row.country_code)} alt="" width={20} height={14} className="rounded-[2px]" />
                      {row.country}
                    </span>
                  ) : "—"}
                </td>
                <td className="whitespace-nowrap px-4 py-3">{row.phone}</td>
                <td className="px-4 py-3">{row.email || "—"}</td>
                <td className="whitespace-nowrap px-4 py-3">{shortDate(row.event_date)}</td>
                <td className="max-w-[16rem] px-4 py-3 text-muted">{row.notes || "—"}</td>
                <td className="whitespace-nowrap px-4 py-3 text-muted">{shortDate(row.created_at)}</td>
              </tr>
            ))}
            {registrations.length === 0 && (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-muted">Todavía no hay inscripciones.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </AdminLayout>
  );
}
