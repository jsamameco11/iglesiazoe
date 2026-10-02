import { Link, usePage } from "@inertiajs/react";
import { can, type PanelUser, type Permission } from "@/lib/access";
import { useInboxShared, useUnread, type InboxKind } from "@/lib/inbox";

type Item = { href: string; label: string; needs: (Permission | "superadmin")[] | null; inbox?: InboxKind };

const groups: { title: string; items: Item[] }[] = [
  { title: "", items: [{ href: "/admin", label: "Resumen", needs: null }] },
  {
    title: "Formularios de la web",
    items: [
      { href: "/admin/formularios/visitas", label: "Visitas planificadas", needs: ["inbox.visits"], inbox: "visitas" },
      { href: "/admin/formularios/bautismos", label: "Bautismo", needs: ["inbox.baptisms"], inbox: "bautismos" },
      { href: "/admin/formularios/oraciones", label: "Petición de oración", needs: ["inbox.prayers"], inbox: "oraciones" },
      { href: "/admin/formularios/servidores", label: "Quiero servir", needs: ["inbox.serve"], inbox: "servidores" },
    ],
  },
  {
    title: "Células",
    items: [
      { href: "/portal/informe", label: "Subir informe", needs: ["reports.submit"] },
      { href: "/portal/seguimiento", label: "Reporte semanal", needs: ["reports.weekly", "reports.all"] },
      { href: "/admin/informes", label: "Reportes de servidores", needs: ["reports.all"] },
      { href: "/admin/ofrendas", label: "Ofrendas por semana", needs: ["offerings.weekly"] },
      { href: "/portal/historial", label: "Historial", needs: ["reports.submit", "reports.all"] },
      { href: "/admin/servidores", label: "Servidores", needs: ["servers.create"] },
      { href: "/admin/celulas", label: "Células e integrantes", needs: ["cells.manage"] },
      { href: "/portal/temas", label: "Temas de célula", needs: ["reports.submit", "themes.manage"] },
      { href: "/admin/temas", label: "Publicar temas", needs: ["themes.manage", "content.manage"] },
    ],
  },
  {
    title: "Página web",
    items: [
      { href: "/admin/indicaciones", label: "Indicaciones de la semana", needs: ["notices.manage"] },
      { href: "/admin/diseno", label: "Diseño", needs: ["design.manage"] },
      { href: "/admin/medios", label: "Imágenes y videos", needs: ["media.manage"] },
      { href: "/admin/contenido", label: "Textos principales", needs: ["content.manage"] },
      { href: "/admin/textos", label: "Textos por página", needs: ["content.manage"] },
      { href: "/admin/ministerios", label: "Ministerios", needs: ["content.manage"] },
      { href: "/admin/predicas", label: "Prédicas", needs: ["content.manage"] },
      { href: "/admin/involucrate", label: "Involúcrate · áreas", needs: ["content.manage"] },
      { href: "/admin/eventos", label: "Eventos", needs: ["events.manage", "content.manage"] },
      { href: "/admin/galeria", label: "Galería de cultos", needs: ["content.manage"] },
      { href: "/admin/devocionales", label: "Devocionales", needs: ["devotionals.manage", "content.manage"] },
      { href: "/admin/recursos", label: "Recursos y enseñanzas", needs: ["content.manage"] },
      { href: "/admin/secciones", label: "Encabezados y Ruta", needs: ["content.manage"] },
      { href: "/admin/bautismos", label: "Bautismos", needs: ["content.manage"] },
      { href: "/admin/generosidad", label: "Generosidad", needs: ["generosity.manage"] },
    ],
  },
  {
    title: "Radio",
    items: [
      { href: "/admin/radio", label: "Consola en vivo", needs: ["radio.manage"] },
      { href: "/admin/radio/programacion", label: "Programación", needs: ["radio.manage"] },
      { href: "/admin/radio/biblioteca", label: "Biblioteca de audio", needs: ["radio.manage"] },
      { href: "/admin/radio/ajustes", label: "Ajustes de la radio", needs: ["radio.manage"] },
    ],
  },
  {
    title: "Estudios · Ruta del Servidor",
    items: [
      { href: "/admin/estudios", label: "Niveles y horarios", needs: ["studies.grades"] },
      { href: "/admin/estudios/estudiantes", label: "Estudiantes", needs: ["studies.grades"] },
      { href: "/admin/estudios/notas", label: "Notas", needs: ["studies.grades"] },
      { href: "/admin/estudios/avisos", label: "Avisos del aula", needs: ["studies.board"] },
      { href: "/admin/estudios/animo", label: "Versículos y ánimo", needs: ["studies.board"] },
      { href: "/admin/estudios/lecturas", label: "Lecturas en PDF", needs: ["studies.board"] },
    ],
  },
  { title: "Atmósfera", items: [{ href: "/admin/gastos", label: "Gastos y compras", needs: ["expenses.manage"] }] },
  {
    title: "Superadmi",
    items: [
      { href: "/admin/finanzas", label: "Finanzas", needs: ["superadmin"] },
      { href: "/admin/equipo", label: "Equipo y accesos", needs: ["superadmin"] },
    ],
  },
];

export function AdminNav({ user, onNavigate }: { user: PanelUser; onNavigate?: () => void }) {
  const pathname = usePage().url.split("?")[0];
  const unread = useUnread(useInboxShared()?.unread);
  const visible = groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        if (!item.needs) return true;
        if (item.needs.includes("superadmin")) return user.superadmin;
        return can(user, ...item.needs);
      }),
    }))
    .filter((group) => group.items.length);

  return (
    <nav className="space-y-6 px-3 pb-6">
      {visible.map((group) => (
        <div key={group.title || "general"}>
          {group.title && <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-white/35">{group.title}</p>}
          <div className="space-y-0.5">
            {group.items.map((item) => {
              const active = ["/admin", "/admin/estudios", "/admin/radio"].includes(item.href) ? pathname === item.href : pathname.startsWith(item.href);
              const fresh = item.inbox && !active ? unread[item.inbox] ?? 0 : 0;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  className={`flex items-center justify-between rounded-xl px-3 py-2 text-[13.5px] font-medium tracking-[-0.01em] transition ${
                    active ? "bg-white text-ink shadow-sm" : "text-white/65 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {item.label}
                  {active && <span className="h-1.5 w-1.5 rounded-full bg-orange" />}
                  {fresh > 0 && (
                    <span className="min-w-[1.35rem] rounded-full bg-orange px-1.5 py-0.5 text-center text-[10.5px] font-semibold leading-4 text-white" aria-label={`${fresh} nuevos`}>
                      {fresh > 99 ? "99+" : fresh}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
