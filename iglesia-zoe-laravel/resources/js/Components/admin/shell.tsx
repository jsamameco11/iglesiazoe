import { router, usePage } from "@inertiajs/react";
import { useEffect, useState, type CSSProperties } from "react";
import type { PanelUser } from "@/lib/access";
import { useSitePalette } from "@/Components/site/palette-scope";
import { AdminNav } from "./admin-nav";

export function AdminShell({ children, user }: { children: React.ReactNode; user: PanelUser }) {
  const [open, setOpen] = useState(false);
  const { flash } = usePage<{ flash?: { denied?: boolean } }>().props as unknown as { flash?: { denied?: boolean } };
  const [denied, setDenied] = useState(Boolean(flash?.denied));
  useEffect(() => setDenied(Boolean(flash?.denied)), [flash?.denied]);
  const { style } = useSitePalette();
  const initials = (user.full_name || user.username || "Z").split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase();

  const identity = (
    <div className="flex items-center gap-3">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/10 text-sm font-semibold">{initials}</span>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">{user.full_name || user.username}</p>
        <p className="truncate text-[10.5px] font-semibold uppercase tracking-[0.14em] text-orange">{user.cereal}</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-paper md:grid md:grid-cols-[272px_1fr]" style={style as CSSProperties}>
      <header className="sticky top-0 z-40 flex items-center justify-between bg-ink px-5 py-3.5 text-white md:hidden">
        {identity}
        <button type="button" onClick={() => setOpen((value) => !value)} className="rounded-full border border-white/15 px-4 py-2 text-xs font-semibold">
          {open ? "Cerrar" : "Menú"}
        </button>
      </header>
      {open && (
        <div className="fixed inset-x-0 bottom-0 top-[64px] z-30 overflow-y-auto bg-ink pt-4 text-white md:hidden">
          <AdminNav user={user} onNavigate={() => setOpen(false)} />
          <div className="px-6 pb-8">
            <button type="button" onClick={() => router.post("/salir")} className="w-full rounded-xl border border-white/15 px-4 py-2.5 text-sm text-white/70">Cerrar sesión</button>
          </div>
        </div>
      )}
      <aside className="hidden bg-ink text-white md:sticky md:top-0 md:flex md:h-screen md:flex-col">
        <div className="px-6 pb-5 pt-7">
          <p className="text-[11px] uppercase tracking-[0.24em] text-white/40">Iglesia Zoe · Panel</p>
          <div className="mt-5">{identity}</div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <AdminNav user={user} />
        </div>
        <div className="space-y-2 border-t border-white/10 px-5 py-4">
          <a href="/" target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-xl px-3 py-2 text-sm text-white/60 transition hover:bg-white/10 hover:text-white">
            Ver la web <span>↗</span>
          </a>
          <button type="button" onClick={() => router.post("/salir")} className="flex w-full items-center justify-between rounded-xl border border-white/10 px-3 py-2.5 text-sm text-white/65 transition hover:bg-white/10 hover:text-white">
            Cerrar sesión <span>→</span>
          </button>
        </div>
      </aside>
      <main className="min-w-0 px-5 py-7 md:px-10 md:py-9 xl:px-14">
        {denied && (
          <div className="mb-6 flex items-start justify-between gap-4 rounded-2xl border border-amber-deep/30 bg-amber/40 px-5 py-4 text-sm">
            <p>Esa sección no está habilitada para tu cuenta. Si la necesitas, pídela al SUPERADMI.</p>
            <button type="button" onClick={() => setDenied(false)} className="text-muted">Cerrar</button>
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
