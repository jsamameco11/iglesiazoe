import { signOut } from "@/app/actions/auth";
import type { AdminCapabilities } from "@/lib/access";
import { AdminNav } from "./admin-nav";

export function AdminShell({
  children,
  roleLabel,
  superadmin,
  capabilities,
}: {
  children: React.ReactNode;
  roleLabel: string;
  superadmin: boolean;
  capabilities: AdminCapabilities;
}) {
  return (
    <div className="min-h-screen bg-paper md:grid md:grid-cols-[260px_1fr]">
      <aside className="border-b border-white/10 bg-ink text-white md:sticky md:top-0 md:h-screen md:border-b-0">
        <div className="px-6 py-7">
          <p className="text-[11px] uppercase tracking-[0.22em] text-white/40">Iglesia Zoe</p>
          <p className="mt-2 text-lg font-semibold tracking-[-0.03em]">{roleLabel}</p>
        </div>
        <AdminNav capabilities={capabilities} superadmin={superadmin} />
        <form action={signOut} className="px-4 pb-4 md:hidden">
          <button className="rounded-xl border border-white/10 px-4 py-2 text-sm text-white/65">Cerrar sesión</button>
        </form>
        <div className="hidden px-6 md:absolute md:bottom-6 md:block md:w-full">
          <div className="border-t border-white/10 pt-5">
            <form action={signOut}>
              <button className="flex w-full items-center justify-between rounded-xl border border-white/10 px-3 py-2.5 text-sm text-white/65 transition hover:bg-white/10 hover:text-white">
                Cerrar sesión <span>→</span>
              </button>
            </form>
          </div>
        </div>
      </aside>
      <main className="min-w-0 px-5 py-7 md:px-10 md:py-9 xl:px-14">{children}</main>
    </div>
  );
}
