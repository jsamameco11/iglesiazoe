import Link from "next/link";
import { signOut } from "@/app/actions/auth";

const links = [
  ["/admin", "Resumen"],
  ["/admin/contenido", "Contenido"],
  ["/admin/ministerios", "Ministerios"],
  ["/admin/predicas", "Prédicas"],
  ["/admin/bautismos", "Bautismos"],
  ["/admin/generosidad", "Generosidad"],
  ["/admin/celulas", "Células"],
  ["/admin/usuarios", "Usuarios"],
  ["/admin/temas", "Temas"],
  ["/admin/informes", "Informes"],
  ["/admin/bandeja", "Bandeja"],
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-paper md:grid md:grid-cols-[240px_1fr]">
      <aside className="border-b border-line bg-ink text-white md:min-h-screen md:border-b-0">
        <div className="px-5 py-6">
          <p className="script text-4xl">Zoe</p>
          <p className="text-xs uppercase tracking-[0.16em] text-white/50">Administrador</p>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-4 md:block">
          {links.map(([href, label]) => (
            <Link key={href} href={href} className="block whitespace-nowrap rounded-xl px-3 py-2 text-sm text-white/80 hover:bg-white/10 hover:text-white">
              {label}
            </Link>
          ))}
        </nav>
        <form action={signOut} className="px-5 py-4"><button className="text-sm text-white/60">Salir</button></form>
      </aside>
      <div className="px-5 py-8 md:px-10">{children}</div>
    </div>
  );
}
