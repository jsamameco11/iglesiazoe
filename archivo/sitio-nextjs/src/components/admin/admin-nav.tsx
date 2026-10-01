"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { AdminCapabilities } from "@/lib/access";

const links = [
  { href: "/admin", label: "Resumen", cap: null },
  { href: "/admin/contenido", label: "Contenido", cap: "manageContent" },
  { href: "/admin/medios", label: "Medios", cap: "manageMedia" },
  { href: "/admin/ministerios", label: "Ministerios", cap: "manageContent" },
  { href: "/admin/predicas", label: "Prédicas", cap: "manageMedia" },
  { href: "/admin/bautismos", label: "Bautismos", cap: "manageContent" },
  { href: "/admin/generosidad", label: "Generosidad", cap: "manageGenerosity" },
  { href: "/admin/celulas", label: "Células", cap: "manageCells" },
  { href: "/admin/usuarios", label: "Usuarios", cap: "manageUsers" },
  { href: "/admin/temas", label: "Temas", cap: "manageContent" },
  { href: "/admin/informes", label: "Informes", cap: "viewCellActivity" },
  { href: "/admin/bandeja", label: "Bandeja", cap: "manageContent" },
  { href: "/admin/accesos", label: "Accesos", cap: "superadmin" },
] as const;

export function AdminNav({
  capabilities,
  superadmin,
}: {
  capabilities: AdminCapabilities;
  superadmin: boolean;
}) {
  const pathname = usePathname();
  const visible = links.filter((link) => {
    if (link.cap === "superadmin") return superadmin;
    if (!link.cap) return true;
    return superadmin || capabilities[link.cap];
  });

  return (
    <nav className="flex gap-1 overflow-x-auto px-3 pb-4 md:block md:space-y-1">
      {visible.map((link) => {
        const active = link.href === "/admin" ? pathname === link.href : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`flex items-center whitespace-nowrap rounded-xl px-3 py-2.5 text-sm font-medium tracking-[-0.01em] transition ${
              active ? "bg-white text-ink shadow-sm" : "text-white/65 hover:bg-white/10 hover:text-white"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
