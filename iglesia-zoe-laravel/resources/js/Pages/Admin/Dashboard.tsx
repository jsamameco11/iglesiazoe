import { Link } from "@inertiajs/react";
import AdminLayout from "@/Layouts/AdminLayout";
import { can, usePanelUser, type Permission } from "@/lib/access";

type Card = { label: string; value: string; href: string; note: string; accent: string };
type Recent = { id: string; code: string | null; met: boolean; theme_title: string | null; week: number; year: number; photos: number };

const shortcuts: { href: string; label: string; text: string; needs: Permission[] | "superadmin" }[] = [
  { href: "/portal/informe", label: "Subir informe", text: "Registra la reunión de esta semana.", needs: ["reports.submit"] },
  { href: "/portal/seguimiento", label: "Reporte semanal", text: "Cómo va tu red esta semana.", needs: ["reports.weekly", "reports.all"] },
  { href: "/admin/informes", label: "Reportes de servidores", text: "Filtra por semana, mes o año.", needs: ["reports.all"] },
  { href: "/admin/ofrendas", label: "Ofrendas por semana", text: "Lo recibido por cada célula.", needs: ["offerings.weekly"] },
  { href: "/admin/servidores", label: "Crear servidor", text: "Abre una célula o una célula hija.", needs: ["servers.create"] },
  { href: "/admin/diseno", label: "Diseño de la página", text: "Colores, tipografías y tamaños.", needs: ["design.manage"] },
  { href: "/admin/medios", label: "Imágenes y videos", text: "Cambia el material visual.", needs: ["media.manage"] },
  { href: "/admin/contenido", label: "Textos de la web", text: "Títulos, horarios y secciones.", needs: ["content.manage"] },
  { href: "/admin/gastos", label: "Registrar gasto", text: "Boleta, detalle y monto.", needs: ["expenses.manage"] },
  { href: "/admin/finanzas", label: "Finanzas", text: "Ingresos, diezmos y gastos.", needs: "superadmin" },
  { href: "/admin/equipo", label: "Equipo y accesos", text: "Crea administradores y define funciones.", needs: "superadmin" },
];

export default function Dashboard({ cards, recent, name }: { cards: Card[]; recent: Recent[]; name: string }) {
  const user = usePanelUser();
  const links = shortcuts.filter((item) => (item.needs === "superadmin" ? user.superadmin : can(user, ...item.needs)));
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Buenos días" : hour < 19 ? "Buenas tardes" : "Buenas noches";

  return (
    <AdminLayout>
      <div className="pb-16">
        <section className="relative overflow-hidden rounded-[2rem] bg-ink px-7 py-9 text-white shadow-[0_24px_80px_rgba(42,39,36,0.16)] md:px-10 md:py-11">
          <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-orange/25 blur-3xl" />
          <div className="absolute -bottom-32 left-1/3 h-64 w-64 rounded-full bg-sky/10 blur-3xl" />
          <div className="relative max-w-3xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-orange">{user.cereal}</p>
            <h1 className="mt-4 text-4xl font-semibold leading-[1.02] tracking-[-0.045em] md:text-[3.4rem]">{greeting}, {name.split(" ")[0]}.</h1>
            <p className="mt-4 max-w-xl text-sm leading-7 text-white/65">
              {user.superadmin
                ? "Tienes todas las funciones: equipo, finanzas, reportes y la página pública."
                : "Este panel muestra solo las funciones que el SUPERADMI habilitó para tu cuenta."}
            </p>
            <div className="mt-7 flex flex-wrap gap-2.5">
              {links.slice(0, 3).map((item, index) => (
                <Link key={item.href} href={item.href} className={index === 0 ? "rounded-full bg-orange px-5 py-2.5 text-sm font-semibold text-white" : "rounded-full border border-white/20 px-5 py-2.5 text-sm font-semibold text-white/90 hover:bg-white/10"}>
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        </section>

        {cards.length > 0 && (
          <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {cards.map((card) => (
              <Link key={card.label} href={card.href} className={`${card.accent} group rounded-[1.6rem] border border-black/5 p-6 transition duration-300 hover:-translate-y-1 hover:shadow-[0_16px_45px_rgba(42,39,36,0.09)]`}>
                <div className="flex items-start justify-between">
                  <p className="text-sm font-semibold">{card.label}</p>
                  <span className="text-lg transition group-hover:translate-x-1">↗</span>
                </div>
                <p className="mt-7 text-[2.1rem] font-semibold leading-none tracking-[-0.045em]">{card.value}</p>
                <p className="mt-3 text-xs text-muted">{card.note}</p>
              </Link>
            ))}
          </section>
        )}

        <section className={`mt-8 grid gap-6 ${recent.length ? "xl:grid-cols-[1.35fr_0.65fr]" : ""}`}>
          {recent.length > 0 && (
            <div className="rounded-[1.75rem] border border-line bg-card p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-orange-deep">Actividad</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em]">Informes recientes</h2>
                </div>
                {can(user, "reports.all") && <Link href="/admin/informes" className="text-sm font-semibold text-orange-deep">Ver todos</Link>}
              </div>
              <div className="mt-5 divide-y divide-line">
                {recent.map((row) => (
                  <div key={row.id} className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{row.code || "Sin célula"} · {row.met ? row.theme_title || "Tema sin título" : "No se reunió"}</p>
                      <p className="mt-1 text-xs text-muted">Semana {row.week} · {row.year}</p>
                    </div>
                    <p className="shrink-0 text-right text-xs text-muted"><span className="block text-sm font-semibold text-ink">{row.photos}</span>fotos</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="rounded-[1.75rem] border border-line bg-white p-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-orange-deep">Tus funciones</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em]">Accesos rápidos</h2>
            <div className={`mt-5 grid gap-2 ${recent.length ? "" : "sm:grid-cols-2 xl:grid-cols-3"}`}>
              {links.map((item) => (
                <Link key={item.href} href={item.href} className="group flex items-center justify-between gap-3 rounded-2xl bg-paper px-4 py-3.5 transition hover:bg-orange/10">
                  <span>
                    <span className="block text-sm font-semibold">{item.label}</span>
                    <span className="mt-0.5 block text-xs text-muted">{item.text}</span>
                  </span>
                  <span className="transition group-hover:translate-x-1">→</span>
                </Link>
              ))}
              {!links.length && <p className="text-sm text-muted">Tu cuenta todavía no tiene funciones. Pídelas al SUPERADMI.</p>}
            </div>
          </div>
        </section>
      </div>
    </AdminLayout>
  );
}
