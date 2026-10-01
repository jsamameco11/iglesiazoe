import AdminLayout from "@/Layouts/AdminLayout";

type Prayer = { id: string; full_name: string; phone: string | null; email: string | null; topic: string | null; request: string };
type Visit = { id: string; full_name: string; phone: string; service: string | null; visit_date: string | null; adults: number; children: number; notes: string | null };

export default function Bandeja({ prayers, visits }: { prayers: Prayer[]; visits: Visit[] }) {
  return (
    <AdminLayout>
      <div className="grid gap-10">
        <section>
          <h1 className="display text-4xl">Bandeja</h1>
          <h2 className="mt-8 text-2xl font-light">Peticiones de oración</h2>
          <div className="mt-4 space-y-3">
            {prayers.map((row) => (
              <article key={row.id} className="rounded-2xl border border-line bg-card p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{row.full_name}</p>
                  {row.topic && <span className="rounded-full bg-paper px-2.5 py-0.5 text-[11px] font-semibold text-accent">{row.topic}</span>}
                </div>
                <p className="text-sm text-muted">{row.phone} {row.email}</p>
                <p className="mt-2 text-sm leading-6">{row.request}</p>
              </article>
            ))}
            {!prayers.length && <p className="text-muted">Sin peticiones todavía.</p>}
          </div>
        </section>
        <section>
          <h2 className="text-2xl font-light">Visitas planificadas</h2>
          <div className="mt-4 space-y-3">
            {visits.map((row) => (
              <article key={row.id} className="rounded-2xl border border-line bg-card p-4">
                <p className="font-medium">{row.full_name} · {row.phone}</p>
                <p className="text-sm text-muted">{row.service} {row.visit_date} · {row.adults} adultos, {row.children} niños</p>
                {row.notes && <p className="mt-2 text-sm">{row.notes}</p>}
              </article>
            ))}
            {!visits.length && <p className="text-muted">Sin visitas registradas.</p>}
          </div>
        </section>
      </div>
    </AdminLayout>
  );
}
