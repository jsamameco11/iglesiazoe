import { Link } from "@inertiajs/react";
import { useMemo, useState } from "react";
import { PushControl } from "@/Components/admin/push-notifications";
import { Notice, PageHeader, input, useAction } from "@/Components/admin/ui";
import AdminLayout from "@/Layouts/AdminLayout";
import { send } from "@/lib/actions";
import { flagUrl } from "@/lib/geo";
import { useInboxShared, useUnread, type InboxKind } from "@/lib/inbox";

type Network = { key: string; label: string; color: string };
type Route = { key: string; label: string; color: string | null };

type Row = {
  id: string;
  full_name: string;
  first_name: string | null;
  last_name: string | null;
  age: number | null;
  marital_status: string | null;
  phone: string | null;
  email: string | null;
  created_at: string | null;
  network: Network;
  sex?: string | null;
  country_code?: string | null;
  country?: string | null;
  place_labels?: string[];
  region?: string | null;
  city?: string | null;
  district?: string | null;
  service?: string | null;
  visit_date?: string | null;
  event_date?: string | null;
  event_location?: string | null;
  notes?: string | null;
  topic?: string | null;
  request?: string;
  on_air?: boolean;
  area_id?: string | null;
  area?: string;
  team?: string | null;
  status?: ServeStatus;
  status_at?: string | null;
  status_by?: string | null;
};

type ServeStatus = "pendiente" | "contactado" | "integrado";

type Props = {
  kind: InboxKind;
  title: string;
  tabs: { key: InboxKind; title: string; href: string }[];
  rows: Row[];
  limit: number;
  seenBefore: string | null;
  routes: Route[];
  statuses: Record<ServeStatus, string> | null;
  scope: string[] | null;
};

const STATUS_TONE: Record<ServeStatus, string> = {
  pendiente: "bg-orange/15 text-orange-deep",
  contactado: "bg-sky text-[#28516b]",
  integrado: "bg-emerald-50 text-emerald-800",
};

const INTRO: Record<InboxKind, string> = {
  visitas: "Cada persona que planificó su visita desde la web, con la red que le corresponde según su edad y estado civil.",
  bautismos: "Cada persona que se inscribió para bautizarse, con la red que le corresponde según su edad y estado civil.",
  oraciones: "Cada petición de oración recibida, con la red que le corresponde. Es confidencial: trátala con cuidado y discreción.",
  servidores: "Cada persona que se inscribió en «Quiero servir», con el área y el equipo que eligió y la red que le corresponde. Escríbele pronto, conéctala con su líder y marca cómo va su seguimiento.",
};

const RESTO_TONE = "linear-gradient(135deg, #3F6FD8, #7A55C7 50%, #178C99)";

const dateTime = new Intl.DateTimeFormat("es-PE", { timeZone: "America/Lima", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
const longDate = new Intl.DateTimeFormat("es-PE", { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" });

function received(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const minutes = Math.round((Date.now() - date.getTime()) / 60000);
  if (minutes < 1) return "Hace un momento";
  if (minutes < 60) return `Hace ${minutes} min`;
  if (minutes < 60 * 24) return `Hace ${Math.round(minutes / 60)} h · ${dateTime.format(date)}`;
  return dateTime.format(date);
}

function whatsapp(phone: string | null) {
  const digits = (phone || "").replace(/\D/g, "");
  return digits.length >= 8 ? `https://wa.me/${digits}` : null;
}

function NetworkButton({ network, onClick }: { network: Network; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={`Filtrar por ${network.label}`}
      className="inline-flex items-center rounded-full px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-white shadow-[0_6px_16px_-8px_rgba(0,0,0,0.45)] transition hover:brightness-110"
      style={{ background: network.color }}
    >
      {network.label}
    </button>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  if (children === null || children === undefined || children === "") return null;
  return (
    <div className="min-w-0">
      <dt className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted">{label}</dt>
      <dd className="mt-0.5 break-words text-[13.5px] leading-5">{children}</dd>
    </div>
  );
}

function Contact({ phone, email }: { phone: string | null; email: string | null }) {
  const chat = whatsapp(phone);
  const pill = "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition";
  if (!phone && !email) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {chat && <a href={chat} target="_blank" rel="noreferrer" className={`${pill} border-emerald-600/30 bg-emerald-50 text-emerald-800 hover:bg-emerald-100`}>WhatsApp</a>}
      {phone && <a href={`tel:${phone.replace(/[^\d+]/g, "")}`} className={`${pill} border-line bg-white hover:border-ink/30`}>Llamar</a>}
      {email && <a href={`mailto:${email}`} className={`${pill} border-line bg-white hover:border-ink/30`}>Correo</a>}
    </div>
  );
}

function FollowUp({ row, statuses }: { row: Row; statuses: Record<ServeStatus, string> }) {
  const { result, setResult, pending, run } = useAction();
  const current = row.status ?? "pendiente";

  return (
    <div className="mt-4 rounded-2xl border border-line bg-paper/60 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted">Seguimiento</p>
        {row.status_at && (
          <p className="text-[11px] text-muted">
            {row.status_by ? `${row.status_by} · ` : ""}
            {dateTime.format(new Date(row.status_at))}
          </p>
        )}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label={`Seguimiento de ${row.full_name}`}>
        {(Object.keys(statuses) as ServeStatus[]).map((key) => (
          <button
            key={key}
            type="button"
            disabled={pending || key === current}
            aria-pressed={key === current}
            onClick={() => run(() => send("/admin/formularios/servidores/estado", { id: row.id, status: key }))}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition disabled:cursor-default ${key === current ? STATUS_TONE[key] : "border border-line bg-white text-muted hover:border-ink/30 hover:text-ink"}`}
          >
            {key === current ? "✓ " : ""}
            {statuses[key]}
          </button>
        ))}
      </div>
      {result?.error && (
        <div className="mt-2">
          <Notice result={result} onClose={() => setResult(null)} />
        </div>
      )}
    </div>
  );
}

function Card({ row, kind, isNew, onNetwork, statuses }: { row: Row; kind: InboxKind; isNew: boolean; onNetwork: () => void; statuses: Props["statuses"] }) {
  const labels = row.place_labels ?? ["Departamento", "Provincia", "Distrito"];
  const profile = [row.age ? `${row.age} años` : null, row.marital_status, row.sex].filter(Boolean).join(" · ");

  return (
    <article className={`rounded-[1.4rem] border bg-card p-5 shadow-[0_18px_50px_-40px_rgba(42,39,36,0.4)] transition ${isNew ? "border-orange/40 ring-4 ring-orange/[0.07]" : "border-line"}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <NetworkButton network={row.network} onClick={onNetwork} />
          {isNew && <span className="rounded-full bg-orange/15 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.12em] text-orange-deep">Nuevo</span>}
          {kind === "oraciones" && row.on_air && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#c62f2f] px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.12em] text-white" title="Pidió que oren por esta petición en la radio">
              <span className="h-1.5 w-1.5 rounded-full bg-white" aria-hidden />
              Orar al aire
            </span>
          )}
          {kind === "servidores" && statuses && row.status && (
            <span className={`rounded-full px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.12em] ${STATUS_TONE[row.status]}`}>{statuses[row.status]}</span>
          )}
        </div>
        {row.created_at && <time dateTime={row.created_at} className="text-xs text-muted">{received(row.created_at)}</time>}
      </div>

      <h3 className="mt-4 text-lg font-semibold leading-tight tracking-[-0.02em]">{row.full_name}</h3>
      {profile && <p className="mt-1 text-sm text-muted">{profile}</p>}

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
        <Detail label="Nombres">{row.first_name}</Detail>
        <Detail label="Apellidos">{row.last_name}</Detail>
        <Detail label="Edad">{row.age ? `${row.age} años` : null}</Detail>
        <Detail label="Estado civil">{row.marital_status}</Detail>
        {kind !== "oraciones" && <Detail label="Sexo">{row.sex}</Detail>}
        {kind !== "oraciones" && row.country && (
          <Detail label="País">
            <span className="inline-flex items-center gap-2">
              {row.country_code && <img src={flagUrl(row.country_code)} alt="" width={20} height={14} className="rounded-[2px]" />}
              {row.country}
            </span>
          </Detail>
        )}
        {kind === "visitas" && (
          <>
            <Detail label="Servicio al que asistirá">{row.service}</Detail>
            <Detail label="Fecha de visita">{row.visit_date ? longDate.format(new Date(`${row.visit_date}T12:00:00Z`)) : null}</Detail>
            {row.country ? (
              <>
                <Detail label={labels[0] ?? "Departamento"}>{row.region}</Detail>
                <Detail label={labels[1] ?? "Provincia"}>{row.city}</Detail>
                <Detail label={labels[2] ?? "Distrito"}>{row.district}</Detail>
              </>
            ) : (
              <Detail label="Procedencia"><span className="text-muted">No la indicó</span></Detail>
            )}
          </>
        )}
        {kind === "bautismos" && (
          <Detail label="Fecha de bautismo">
            {row.event_date ? [longDate.format(new Date(`${row.event_date}T12:00:00Z`)), row.event_location].filter(Boolean).join(" · ") : "Por confirmar"}
          </Detail>
        )}
        {kind === "oraciones" && <Detail label="Motivo">{row.topic}</Detail>}
        {kind === "servidores" && (
          <>
            <Detail label="Área">{row.area}</Detail>
            <Detail label="Equipo">{row.team || "Por definir"}</Detail>
          </>
        )}
        <Detail label="Teléfono">{row.phone}</Detail>
        <Detail label="Correo">{row.email}</Detail>
      </dl>

      {kind === "bautismos" && row.notes && (
        <div className="mt-4 rounded-2xl bg-paper px-4 py-3">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted">Su decisión</p>
          <p className="mt-1 whitespace-pre-line text-sm leading-6">{row.notes}</p>
        </div>
      )}
      {kind === "servidores" && row.notes && (
        <div className="mt-4 rounded-2xl bg-paper px-4 py-3">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted">Su mensaje</p>
          <p className="mt-1 whitespace-pre-line text-sm leading-6">{row.notes}</p>
        </div>
      )}
      {kind === "servidores" && statuses && <FollowUp row={row} statuses={statuses} />}
      {kind === "oraciones" && row.request && (
        <div className="mt-4 rounded-2xl bg-paper px-4 py-3">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted">Petición</p>
          <p className="mt-1 whitespace-pre-line text-sm leading-6">{row.request}</p>
        </div>
      )}

      <div className="mt-4 border-t border-line pt-4">
        <Contact phone={row.phone} email={row.email} />
      </div>
    </article>
  );
}

export default function Formularios({ kind, title, tabs, rows, limit, seenBefore, routes, statuses, scope }: Props) {
  const [route, setRoute] = useState("all");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<ServeStatus | "all">("all");
  const [area, setArea] = useState("all");
  const [onAirOnly, setOnAirOnly] = useState(false);
  const unread = useUnread(useInboxShared()?.unread);
  const seen = seenBefore ? new Date(seenBefore).getTime() : null;
  const serve = kind === "servidores" && statuses !== null;

  const counts = useMemo(() => {
    const result: Record<string, number> = { all: rows.length };
    rows.forEach((row) => (result[row.network.key] = (result[row.network.key] ?? 0) + 1));
    return result;
  }, [rows]);

  const areas = useMemo(() => {
    const found = new Map<string, { name: string; total: number }>();
    rows.forEach((row) => {
      if (!row.area) return;
      const key = row.area_id || row.area;
      found.set(key, { name: row.area, total: (found.get(key)?.total ?? 0) + 1 });
    });
    return [...found.entries()].map(([key, value]) => ({ key, ...value })).sort((a, b) => a.name.localeCompare(b.name, "es"));
  }, [rows]);

  const statusCounts = useMemo(() => {
    const result: Record<string, number> = { all: rows.length };
    rows.forEach((row) => row.status && (result[row.status] = (result[row.status] ?? 0) + 1));
    return result;
  }, [rows]);

  const onAirCount = useMemo(() => (kind === "oraciones" ? rows.filter((row) => row.on_air).length : 0), [rows, kind]);
  const airFilter = onAirOnly && onAirCount > 0;

  const list = useMemo(() => {
    const text = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (route !== "all" && row.network.key !== route) return false;
      if (serve && status !== "all" && row.status !== status) return false;
      if (serve && area !== "all" && (row.area_id || row.area) !== area) return false;
      if (airFilter && !row.on_air) return false;
      if (!text) return true;
      return [row.full_name, row.phone, row.email, row.topic, row.service, row.country, row.region, row.city, row.district, row.area, row.team]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(text);
    });
  }, [rows, route, query, serve, status, area, airFilter]);

  const pill = (on: boolean) => `shrink-0 rounded-full px-3.5 py-2 text-xs font-semibold transition ${on ? "bg-ink text-white" : "border border-line bg-white text-muted hover:text-ink"}`;

  const isNew = (row: Row) => (seen === null ? false : Boolean(row.created_at && new Date(row.created_at).getTime() > seen));

  return (
    <AdminLayout>
      <div className="space-y-6 pb-16">
        <PageHeader kicker="Formularios de la web" title={title} text={INTRO[kind]} aside={<PushControl />} />

        <nav className="flex gap-1 overflow-x-auto rounded-full border border-line bg-white p-1 [scrollbar-width:none]" aria-label="Formularios">
          {tabs.map((tab) => {
            const active = tab.key === kind;
            const fresh = active ? 0 : unread[tab.key] ?? 0;
            return (
              <Link
                key={tab.key}
                href={tab.href}
                preserveScroll
                className={`flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-[13px] font-semibold transition ${active ? "bg-ink text-white" : "text-muted hover:text-ink"}`}
              >
                {tab.title}
                {fresh > 0 && <span className="rounded-full bg-orange px-1.5 text-[10.5px] leading-[1.15rem] text-white">{fresh}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-5">
          {[{ key: "all", label: "Todas las redes", color: null as string | null }, ...routes].map((item) => {
            const active = route === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setRoute(item.key)}
                aria-pressed={active}
                className={`rounded-[1.2rem] border p-4 text-left transition ${active ? "border-ink bg-ink text-white" : "border-line bg-white hover:border-ink/30"}`}
              >
                <span className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em]">
                  {item.key !== "all" && <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: item.color ?? RESTO_TONE }} />}
                  {item.label}
                </span>
                <span className="mt-2 block text-2xl font-semibold tracking-[-0.04em]">{counts[item.key] ?? 0}</span>
              </button>
            );
          })}
        </div>

        {serve && scope && (
          <p className="rounded-2xl border border-line bg-white px-4 py-3 text-sm text-muted">
            Recibes las inscripciones de <strong className="font-semibold text-ink">{scope.join(", ") || "las áreas que te asignaron"}</strong>. El SUPERADMI puede cambiarlo desde Equipo y accesos.
          </p>
        )}

        {serve && statuses && (
          <div className="space-y-2.5">
            <div className="flex gap-2 overflow-x-auto [scrollbar-width:none]" role="group" aria-label="Filtrar por seguimiento">
              {(["all", ...Object.keys(statuses)] as (ServeStatus | "all")[]).map((key) => (
                <button key={key} type="button" onClick={() => setStatus(key)} aria-pressed={status === key} className={pill(status === key)}>
                  {key === "all" ? "Todos" : statuses[key]} · {statusCounts[key] ?? 0}
                </button>
              ))}
            </div>
            {areas.length > 1 && (
              <div className="flex gap-2 overflow-x-auto [scrollbar-width:none]" role="group" aria-label="Filtrar por área">
                <button type="button" onClick={() => setArea("all")} aria-pressed={area === "all"} className={pill(area === "all")}>Todas las áreas</button>
                {areas.map((item) => (
                  <button key={item.key} type="button" onClick={() => setArea(item.key)} aria-pressed={area === item.key} className={pill(area === item.key)}>
                    {item.name} · {item.total}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {onAirCount > 0 && (
          <div className="flex gap-2 overflow-x-auto [scrollbar-width:none]" role="group" aria-label="Filtrar por radio">
            <button type="button" onClick={() => setOnAirOnly(false)} aria-pressed={!airFilter} className={pill(!airFilter)}>
              Todas · {rows.length}
            </button>
            <button type="button" onClick={() => setOnAirOnly(true)} aria-pressed={airFilter} className={pill(airFilter)}>
              Para orar al aire · {onAirCount}
            </button>
          </div>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nombre, teléfono o correo" className={`${input} mt-0 sm:max-w-sm`} aria-label="Buscar" />
          <p className="text-xs text-muted">
            {list.length === rows.length ? `${rows.length} ${rows.length === 1 ? "registro" : "registros"}` : `${list.length} de ${rows.length}`}
            {rows.length >= limit && ` · se muestran los ${limit} más recientes`}
          </p>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          {list.map((row) => (
            <Card key={row.id} row={row} kind={kind} isNew={isNew(row)} onNetwork={() => setRoute(row.network.key)} statuses={statuses} />
          ))}
        </div>
        {!list.length && (
          <p className="rounded-[1.4rem] border border-dashed border-line px-5 py-14 text-center text-sm text-muted">
            {rows.length ? "No hay registros con ese filtro." : "Todavía no llega ningún formulario. Aparecerán aquí al instante."}
          </p>
        )}
      </div>
    </AdminLayout>
  );
}
