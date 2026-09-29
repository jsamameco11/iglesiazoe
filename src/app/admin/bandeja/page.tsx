import { getSession } from "@/lib/session";

export default async function InboxAdmin() {
  const { supabase } = await getSession();
  const [{ data: prayers }, { data: visits }] = await Promise.all([
    supabase.from("prayer_requests").select("*").order("created_at", { ascending: false }).limit(50),
    supabase.from("visit_plans").select("*").order("created_at", { ascending: false }).limit(50),
  ]);
  return (
    <div className="grid gap-10">
      <section>
        <h1 className="display text-4xl">Bandeja</h1>
        <h2 className="mt-8 text-2xl font-light">Peticiones de oración</h2>
        <div className="mt-4 space-y-3">
          {(prayers || []).map((row) => (
            <article key={row.id} className="rounded-2xl border border-line bg-card p-4">
              <p className="font-medium">{row.full_name}</p>
              <p className="text-sm text-muted">{row.phone} {row.email}</p>
              <p className="mt-2 text-sm leading-6">{row.request}</p>
            </article>
          ))}
          {!(prayers || []).length && <p className="text-muted">Sin peticiones todavía.</p>}
        </div>
      </section>
      <section>
        <h2 className="text-2xl font-light">Visitas planificadas</h2>
        <div className="mt-4 space-y-3">
          {(visits || []).map((row) => (
            <article key={row.id} className="rounded-2xl border border-line bg-card p-4">
              <p className="font-medium">{row.full_name} · {row.phone}</p>
              <p className="text-sm text-muted">{row.service} {row.visit_date} · {row.adults} adultos, {row.children} niños</p>
              {row.notes && <p className="mt-2 text-sm">{row.notes}</p>}
            </article>
          ))}
          {!(visits || []).length && <p className="text-muted">Sin visitas registradas.</p>}
        </div>
      </section>
    </div>
  );
}
