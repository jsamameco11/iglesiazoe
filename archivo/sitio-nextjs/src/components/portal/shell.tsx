import Link from "next/link";
import { signOut } from "@/app/actions/auth";
import { isStaff } from "@/lib/access";
import type { Profile } from "@/lib/types";

const tabs = [
  { href: "/portal/temas", label: "Temas" },
  { href: "/portal/informe", label: "Informe semanal" },
  { href: "/portal/historial", label: "Historial" },
  { href: "/portal/seguimiento", label: "Seguimiento" },
];

export function PortalShell({ profile, children }: { profile: Profile; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b border-line bg-ink text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-white/60">Grupos celulares</p>
            <p className="text-lg font-medium">Iglesia Cristiana Zoe</p>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="hidden text-white/70 sm:inline">{profile.full_name || profile.username}</span>
            {isStaff(profile.role) && <Link href="/admin" className="text-orange">Panel</Link>}
            <form action={signOut}><button className="text-white/70">Salir</button></form>
          </div>
        </div>
      </header>
      <nav className="border-b border-line bg-card">
        <div className="mx-auto flex max-w-6xl gap-2 overflow-x-auto px-5">
          {tabs.map((tab) => (
            <Link key={tab.href} href={tab.href} className="border-b-2 border-transparent px-3 py-4 text-sm font-medium hover:border-orange">
              {tab.label}
            </Link>
          ))}
        </div>
      </nav>
      <div className="mx-auto max-w-6xl px-5 py-8">{children}</div>
    </div>
  );
}
