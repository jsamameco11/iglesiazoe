import { getSession } from "@/lib/session";

export default async function AdminHome() {
  const { supabase } = await getSession();
  const [cells, reports, baptisms, prayers, visits] = await Promise.all([
    supabase.from("cells").select("id", { count: "exact", head: true }),
    supabase.from("reports").select("id", { count: "exact", head: true }),
    supabase.from("baptism_registrations").select("id", { count: "exact", head: true }),
    supabase.from("prayer_requests").select("id", { count: "exact", head: true }),
    supabase.from("visit_plans").select("id", { count: "exact", head: true }),
  ]);
  const cards = [
    ["Células", cells.count || 0],
    ["Informes", reports.count || 0],
    ["Bautismos", baptisms.count || 0],
    ["Oraciones", prayers.count || 0],
    ["Visitas", visits.count || 0],
  ];
  return (
    <div>
      <h1 className="display text-4xl">Resumen</h1>
      <p className="mt-2 text-muted">Todo el sitio público y los grupos celulares se administran desde aquí.</p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map(([label, value]) => (
          <div key={String(label)} className="rounded-[1.5rem] border border-line bg-card p-6">
            <p className="text-sm text-muted">{label}</p>
            <p className="display mt-2 text-5xl">{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
