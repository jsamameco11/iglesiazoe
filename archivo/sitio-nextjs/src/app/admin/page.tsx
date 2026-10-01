import Link from "next/link";
import { getSession } from "@/lib/session";

export default async function AdminHome() {
  const { supabase } = await getSession();
  const [cells, reports, baptisms, prayers, visits, users, recentReports] = await Promise.all([
    supabase.from("cells").select("id", { count: "exact", head: true }),
    supabase.from("reports").select("id", { count: "exact", head: true }),
    supabase.from("baptism_registrations").select("id", { count: "exact", head: true }),
    supabase.from("prayer_requests").select("id", { count: "exact", head: true }),
    supabase.from("visit_plans").select("id", { count: "exact", head: true }),
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase
      .from("reports")
      .select("id, year, week, met, theme_title, updated_at, cells(code), report_photos(id)")
      .order("updated_at", { ascending: false })
      .limit(5),
  ]);
  const cards = [
    { label: "Células", value: cells.count || 0, href: "/admin/celulas", note: "Redes y grupos activos", accent: "bg-mist" },
    { label: "Informes", value: reports.count || 0, href: "/admin/informes", note: "Seguimiento semanal", accent: "bg-blush" },
    { label: "Usuarios", value: users.count || 0, href: "/admin/usuarios", note: "Líderes y administradores", accent: "bg-sky" },
    { label: "Bautismos", value: baptisms.count || 0, href: "/admin/bautismos", note: "Registros recibidos", accent: "bg-[#f1eadc]" },
    { label: "Oraciones", value: prayers.count || 0, href: "/admin/bandeja", note: "Peticiones en bandeja", accent: "bg-[#e8ece5]" },
    { label: "Visitas", value: visits.count || 0, href: "/admin/bandeja", note: "Personas por recibir", accent: "bg-[#eee7f3]" },
  ];
  return (
    <div className="pb-16">
      <section className="relative overflow-hidden rounded-[2rem] bg-ink px-7 py-10 text-white shadow-[0_24px_80px_rgba(42,39,36,0.16)] md:px-10">
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-orange/20 blur-3xl" />
        <div className="relative max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-orange">Centro de administración</p>
          <h1 className="display mt-5 text-5xl md:text-6xl">Todo Zoe, en un solo lugar.</h1>
          <p className="mt-5 max-w-2xl text-sm leading-7 text-white/65">
            Gestiona el contenido público, acompaña a las células y revisa cada respuesta pastoral desde un panel seguro y ordenado.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/admin/informes" className="rounded-full bg-orange px-5 py-3 text-sm font-semibold text-white">
              Revisar informes
            </Link>
            <Link href="/admin/contenido" className="rounded-full border border-white/20 px-5 py-3 text-sm font-semibold text-white">
              Editar sitio público
            </Link>
            <Link href="/admin/medios" className="rounded-full border border-white/20 px-5 py-3 text-sm font-semibold text-white">
              Imágenes y videos
            </Link>
          </div>
        </div>
      </section>

      <section className="mt-9">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-deep">Vista general</p>
            <h2 className="display mt-2 text-4xl">Resumen operativo</h2>
          </div>
          <p className="hidden text-sm text-muted sm:block">Información actualizada desde la base de datos</p>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {cards.map((card) => (
            <Link
              key={card.label}
              href={card.href}
              className={`${card.accent} group rounded-[1.6rem] border border-black/5 p-6 transition duration-300 hover:-translate-y-1 hover:shadow-[0_16px_45px_rgba(42,39,36,0.09)]`}
            >
              <div className="flex items-start justify-between">
                <p className="text-sm font-semibold">{card.label}</p>
                <span className="text-lg transition group-hover:translate-x-1">↗</span>
              </div>
              <p className="display mt-8 text-6xl">{card.value}</p>
              <p className="mt-3 text-xs text-muted">{card.note}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-10 grid gap-6 xl:grid-cols-[1.4fr_0.6fr]">
        <div className="rounded-[1.75rem] border border-line bg-card p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-deep">Actividad</p>
              <h2 className="mt-2 text-2xl font-medium">Informes recientes</h2>
            </div>
            <Link href="/admin/informes" className="text-sm font-semibold text-orange-deep">Ver todos</Link>
          </div>
          <div className="mt-5 divide-y divide-line">
            {(recentReports.data || []).map((row) => (
              <Link key={row.id} href="/admin/informes" className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    {(row.cells as { code?: string } | null)?.code || "Sin célula"} · {row.met ? row.theme_title || "Tema sin título" : "No se reunió"}
                  </p>
                  <p className="mt-1 text-xs text-muted">Semana {row.week} · {row.year}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold">{((row.report_photos as { id: string }[]) || []).length}</p>
                  <p className="text-[11px] text-muted">imágenes</p>
                </div>
              </Link>
            ))}
            {!(recentReports.data || []).length && <p className="py-8 text-center text-sm text-muted">Todavía no hay informes.</p>}
          </div>
        </div>

        <div className="rounded-[1.75rem] border border-line bg-white p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-deep">Accesos rápidos</p>
          <h2 className="mt-2 text-2xl font-medium">Tareas frecuentes</h2>
          <div className="mt-5 space-y-2">
            {[
              ["/admin/temas", "Publicar tema semanal"],
              ["/admin/usuarios", "Crear usuario"],
              ["/admin/celulas", "Administrar células"],
              ["/admin/bandeja", "Revisar bandeja"],
            ].map(([href, label]) => (
              <Link key={href} href={href} className="flex items-center justify-between rounded-xl bg-paper px-4 py-3 text-sm font-medium transition hover:bg-orange/10">
                {label}<span>→</span>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
