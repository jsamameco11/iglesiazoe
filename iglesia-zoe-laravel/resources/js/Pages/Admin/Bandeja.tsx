import { PageHeader, Panel, Stat } from "@/Components/admin/ui";
import AdminLayout from "@/Layouts/AdminLayout";
import { flagUrl } from "@/lib/geo";

type Prayer = { id: string; full_name: string; phone: string | null; email: string | null; topic: string | null; request: string; created_at: string | null };
type Visit = {
  id: string;
  full_name: string;
  phone: string;
  email: string | null;
  sex: string | null;
  age: number | null;
  marital_status: string | null;
  country_code: string | null;
  country: string | null;
  place: string | null;
  service: string | null;
  visit_date: string | null;
  notes: string | null;
  created_at: string | null;
};

function shortDate(value: string | null) {
  if (!value) return "";
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("es-PE", { day: "numeric", month: "short", year: "numeric" });
}

function whatsapp(phone: string | null) {
  const digits = (phone || "").replace(/\D/g, "");
  return digits.length >= 8 ? `https://wa.me/${digits}` : null;
}

function Contact({ phone, email }: { phone: string | null; email: string | null }) {
  const chat = whatsapp(phone);
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
      {phone && (chat ? <a href={chat} target="_blank" rel="noreferrer" className="font-medium text-accent hover:underline">{phone}</a> : <span>{phone}</span>)}
      {email && <a href={`mailto:${email}`} className="break-all text-muted hover:text-ink">{email}</a>}
    </div>
  );
}

export default function Bandeja({ prayers, visits }: { prayers: Prayer[]; visits: Visit[] }) {
  return (
    <AdminLayout>
      <div className="space-y-6">
        <PageHeader kicker="Contenido" title="Bandeja" text="Las visitas planificadas y las peticiones de oración que llegan desde la web. Toca un teléfono para escribir por WhatsApp." />

        <div className="grid gap-3 sm:grid-cols-2">
          <Stat label="Visitas planificadas" value={visits.length} note="Últimas 50" tone="bg-white" />
          <Stat label="Peticiones de oración" value={prayers.length} note="Últimas 50" tone="bg-paper" />
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <Panel title="Visitas planificadas">
            <div className="space-y-3">
              {visits.map((row) => (
                <article key={row.id} className="rounded-2xl border border-line bg-white p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="font-semibold">{row.full_name}</p>
                    {row.created_at && <span className="text-xs text-muted">Recibido {shortDate(row.created_at)}</span>}
                  </div>
                  <p className="mt-1 text-sm text-muted">
                    {[row.sex, row.age ? `${row.age} años` : null, row.marital_status].filter(Boolean).join(" · ")}
                  </p>
                  {(row.country || row.place) && (
                    <p className="mt-1 flex items-center gap-2 text-sm text-muted">
                      {row.country_code && <img src={flagUrl(row.country_code)} alt="" width={20} height={14} className="rounded-[2px]" />}
                      {[row.place, row.country].filter(Boolean).join(", ")}
                    </p>
                  )}
                  {(row.service || row.visit_date) && (
                    <p className="mt-2 inline-flex rounded-full bg-paper px-3 py-1 text-xs font-semibold text-accent">
                      {[row.service, shortDate(row.visit_date)].filter(Boolean).join(" · ")}
                    </p>
                  )}
                  <div className="mt-2"><Contact phone={row.phone} email={row.email} /></div>
                  {row.notes && <p className="mt-2 text-sm leading-6">{row.notes}</p>}
                </article>
              ))}
              {!visits.length && <p className="py-6 text-center text-sm text-muted">Sin visitas registradas.</p>}
            </div>
          </Panel>

          <Panel title="Peticiones de oración">
            <div className="space-y-3">
              {prayers.map((row) => (
                <article key={row.id} className="rounded-2xl border border-line bg-white p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{row.full_name}</p>
                      {row.topic && <span className="rounded-full bg-paper px-2.5 py-0.5 text-[11px] font-semibold text-accent">{row.topic}</span>}
                    </div>
                    {row.created_at && <span className="text-xs text-muted">{shortDate(row.created_at)}</span>}
                  </div>
                  <div className="mt-1"><Contact phone={row.phone} email={row.email} /></div>
                  <p className="mt-2 whitespace-pre-line text-sm leading-6">{row.request}</p>
                </article>
              ))}
              {!prayers.length && <p className="py-6 text-center text-sm text-muted">Sin peticiones todavía.</p>}
            </div>
          </Panel>
        </div>
      </div>
    </AdminLayout>
  );
}
