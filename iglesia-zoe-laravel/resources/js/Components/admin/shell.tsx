import { router, usePage } from "@inertiajs/react";
import { useEffect, useState, type CSSProperties } from "react";
import type { PanelUser } from "@/lib/access";
import { useInboxPulse, useInboxShared, useUnread } from "@/lib/inbox";
import { useSiteDesign } from "@/lib/design";
import { AdminNav } from "./admin-nav";
import { PushPrompt } from "./push-notifications";

type ShellProps = { flash?: { denied?: boolean }; entrance?: { admin: boolean; siteUrl: string } };

export function AdminShell({ children, user }: { children: React.ReactNode; user: PanelUser }) {
  const [open, setOpen] = useState(false);
  const { flash, entrance } = usePage().props as unknown as ShellProps;
  const [denied, setDenied] = useState(Boolean(flash?.denied));
  useEffect(() => setDenied(Boolean(flash?.denied)), [flash?.denied]);
  const { style } = useSiteDesign();
  const initials = (user.full_name || user.username || "Z").split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase();
  const siteUrl = entrance?.siteUrl || "/";
  const inbox = useInboxShared();
  const unread = useUnread(inbox?.unread);
  const fresh = Object.values(unread).reduce((sum, value) => sum + (value ?? 0), 0);
  useInboxPulse(Boolean(inbox));

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const identity = (
    <div className="flex min-w-0 items-center gap-3">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/10 text-sm font-semibold">{initials}</span>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">{user.full_name || user.username}</p>
        <p className="truncate text-[10.5px] font-semibold uppercase tracking-[0.14em] text-orange">{user.cereal}</p>
      </div>
    </div>
  );

  const footer = (
    <div className="space-y-2">
      <a href={siteUrl} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-xl px-3 py-2 text-sm text-white/60 transition hover:bg-white/10 hover:text-white">
        Ver la web <span aria-hidden>↗</span>
      </a>
      <button type="button" onClick={() => router.post("/salir")} className="flex w-full items-center justify-between rounded-xl border border-white/10 px-3 py-2.5 text-sm text-white/65 transition hover:bg-white/10 hover:text-white">
        Cerrar sesión <span aria-hidden>→</span>
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-paper" style={style as CSSProperties}>
      <header className="fixed inset-x-0 top-0 z-40 flex h-16 items-center justify-between gap-3 bg-ink px-5 text-white md:hidden">
        {identity}
        <button
          type="button"
          aria-expanded={open}
          aria-controls="panel-menu"
          onClick={() => setOpen((value) => !value)}
          className="relative shrink-0 rounded-full border border-white/15 px-4 py-2 text-xs font-semibold"
        >
          {open ? "Cerrar" : "Menú"}
          {!open && fresh > 0 && (
            <span className="absolute -right-1.5 -top-1.5 min-w-[1.25rem] rounded-full bg-orange px-1 text-center text-[10px] font-semibold leading-5 text-white" aria-label={`${fresh} formularios nuevos`}>
              {fresh > 99 ? "99+" : fresh}
            </span>
          )}
        </button>
      </header>
      {open && (
        <div id="panel-menu" className="fixed inset-x-0 bottom-0 top-16 z-30 flex flex-col overflow-hidden bg-ink text-white md:hidden">
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pt-4">
            <AdminNav user={user} onNavigate={() => setOpen(false)} />
          </div>
          <div className="border-t border-white/10 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{footer}</div>
        </div>
      )}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[272px] flex-col bg-ink text-white md:flex">
        <div className="px-6 pb-5 pt-7">
          <p className="text-[11px] uppercase tracking-[0.24em] text-white/40">Iglesia Zoe · Panel</p>
          <div className="mt-5">{identity}</div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-color:rgba(255,255,255,0.18)_transparent] [scrollbar-width:thin]">
          <AdminNav user={user} />
        </div>
        <div className="border-t border-white/10 px-5 py-4">{footer}</div>
      </aside>
      <main className="min-w-0 px-5 pb-10 pt-[5.5rem] md:ml-[272px] md:px-10 md:py-9 xl:px-14">
        {denied && (
          <div className="mb-6 flex items-start justify-between gap-4 rounded-2xl border border-amber-deep/30 bg-amber/40 px-5 py-4 text-sm">
            <p>Esa sección no está habilitada para tu cuenta. Si la necesitas, pídela al SUPERADMI.</p>
            <button type="button" onClick={() => setDenied(false)} className="text-muted">Cerrar</button>
          </div>
        )}
        <PushPrompt />
        {children}
      </main>
    </div>
  );
}
