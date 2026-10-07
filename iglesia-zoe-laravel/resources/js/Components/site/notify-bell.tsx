import { useEffect, useRef, useState } from "react";
import { useSitePush, type SitePushStatus } from "@/lib/site-push";

const PITCH = "Te avisamos 5 minutos antes de cada programa de Radio Zoe, cuando estemos en vivo y cuando subamos una prédica nueva.";

const HELP: Partial<Record<SitePushStatus, string>> = {
  denied: "Las bloqueaste en este navegador. Toca el candado junto a la dirección de la página → Notificaciones → Permitir, y recarga.",
  ios: "En iPhone: toca Compartir → «Agregar a pantalla de inicio», abre la web desde ese ícono y activa los avisos ahí.",
  unsupported: "Este navegador no permite notificaciones. Prueba con Chrome, Edge o Firefox.",
};

function BellIcon({ on }: { on: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="h-[18px] w-[18px]" fill={on ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9a6 6 0 1 1 12 0c0 4.5 1.6 6.3 2.4 7.1.3.3.1.9-.4.9H4c-.5 0-.7-.6-.4-.9C4.4 15.3 6 13.5 6 9Z" />
      <path d="M10 20.5a2.2 2.2 0 0 0 4 0" fill="none" />
    </svg>
  );
}

/** What the visitor can do with the notices of this device: turn them on or off, or how to unblock them. */
function NotifyPanel({ push }: { push: ReturnType<typeof useSitePush> }) {
  const { status, busy, message } = push;
  return (
    <>
      <p className="text-[13.5px] leading-6 text-muted">{PITCH}</p>
      {HELP[status] ? <p className="mt-3 rounded-xl bg-paper px-3.5 py-3 text-[13px] leading-5 text-ink">{HELP[status]}</p> : null}
      {status === "off" ? (
        <button type="button" onClick={push.enable} disabled={busy} className="btn-accent mt-4 w-full rounded-full px-4 py-2.5 text-[13.5px] font-semibold disabled:opacity-60">
          {busy ? "Activando…" : "Activar avisos"}
        </button>
      ) : null}
      {status === "on" ? (
        <div className="mt-4 flex items-center justify-between gap-3">
          <span className="text-[13px] font-semibold text-ink">✓ Activados en este dispositivo</span>
          <button type="button" onClick={push.disable} disabled={busy} className="shrink-0 text-[12.5px] font-medium text-muted underline-offset-4 hover:text-ink hover:underline disabled:opacity-60">
            {busy ? "…" : "Desactivar"}
          </button>
        </div>
      ) : null}
      {message ? (
        <p className={`mt-3 text-[12.5px] leading-5 ${message.error ? "text-accent" : "text-muted"}`} role="status">
          {message.text}
        </p>
      ) : null}
    </>
  );
}

/** Bell of the header: opens a small card to turn the notices of this device on or off. */
export function NotifyBell({ ghost }: { ghost?: boolean }) {
  const push = useSitePush();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => !box.current?.contains(event.target as Node) && setOpen(false);
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (ghost) return <span className="hidden h-10 w-10 shrink-0 sm:inline-block" aria-hidden />;

  const on = push.status === "on";
  return (
    <div ref={box} className="relative hidden sm:block">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="notify-bell"
        data-on={on || undefined}
        aria-expanded={open}
        aria-label={on ? "Avisos activados" : "Activar avisos"}
        title={on ? "Avisos activados" : "Activar avisos"}
      >
        <BellIcon on={on} />
      </button>
      {open ? (
        <div className="notify-pop" role="dialog" aria-label="Avisos de Iglesia Zoe">
          <p className="text-[15px] font-semibold tracking-[-0.02em] text-ink">Avisos en este dispositivo</p>
          <div className="mt-1.5">
            <NotifyPanel push={push} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** The same choice inside the phone menu, where the header has no room for the bell. */
export function NotifyCard() {
  const push = useSitePush();
  const on = push.status === "on";
  return (
    <div className="notify-card">
      <p className="flex items-center gap-2 text-[14px] font-semibold text-ink">
        <BellIcon on={on} />
        Avisos en este dispositivo
      </p>
      <div className="mt-1.5">
        <NotifyPanel push={push} />
      </div>
    </div>
  );
}
