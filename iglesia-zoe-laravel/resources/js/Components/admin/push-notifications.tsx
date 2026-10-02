import { router } from "@inertiajs/react";
import { useEffect, useState } from "react";
import { enablePush, isIos, PUSH_CHANGED, pushPermission, setMuted, syncPush, useInboxShared, type PushState } from "@/lib/inbox";
import type { ActionResult } from "@/lib/actions";

const DISMISSED = "zoe:push-prompt-dismissed";

/** Permission of this browser plus whether this device is registered for the signed-in account. */
function usePushDevice(publicKey: string | null) {
  const [state, setState] = useState<PushState>("unsupported");
  const [active, setActive] = useState(false);

  useEffect(() => {
    let alive = true;
    const check = () => {
      const current = pushPermission();
      setState(current);
      if (current === "granted") syncPush(publicKey).then((value) => alive && setActive(value));
    };
    check();
    window.addEventListener(PUSH_CHANGED, check);
    return () => {
      alive = false;
      window.removeEventListener(PUSH_CHANGED, check);
    };
  }, [publicKey]);

  async function enable(): Promise<ActionResult> {
    const result = await enablePush(publicKey);
    setState(pushPermission());
    if (!result.error) setActive(true);
    return result;
  }

  return { state, active, enable };
}

function BellIcon({ off = false }: { off?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px] shrink-0" aria-hidden="true">
      <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      {off && <path d="M3 3l18 18" />}
    </svg>
  );
}

/** Slim banner across the panel until this device receives the notifications. */
export function PushPrompt() {
  const inbox = useInboxShared();
  const { state, active, enable } = usePushDevice(inbox?.push.publicKey ?? null);
  const [hidden, setHidden] = useState(true);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => setHidden(sessionStorage.getItem(DISMISSED) === "1"), []);

  if (!inbox || inbox.push.muted || hidden || active || state !== "default") return null;

  async function activate() {
    setPending(true);
    const result = await enable();
    setPending(false);
    setError(result.error || "");
  }

  return (
    <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-orange/25 bg-orange/[0.07] px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3 text-sm">
        <span className="mt-0.5 text-orange-deep"><BellIcon /></span>
        <div>
          <p className="font-semibold">Recibe los formularios al instante en este celular</p>
          <p className="mt-0.5 text-[13px] leading-5 text-muted">
            Te avisaremos cada vez que alguien planifique su visita, se inscriba para bautizarse o pida oración.
          </p>
          {error && <p className="mt-1 text-[13px] text-red-700">{error}</p>}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {inbox.push.canMute && (
          <button type="button" onClick={() => { sessionStorage.setItem(DISMISSED, "1"); setHidden(true); }} className="rounded-full px-3 py-2 text-xs font-semibold text-muted hover:text-ink">
            Ahora no
          </button>
        )}
        <button type="button" onClick={activate} disabled={pending} className="rounded-full bg-ink px-4 py-2 text-xs font-semibold text-white transition hover:bg-ink/90 disabled:opacity-60">
          {pending ? "Activando…" : "Activar notificaciones"}
        </button>
      </div>
    </div>
  );
}

/** Status of the notifications on the form pages. Only the superadmin can turn them off. */
export function PushControl() {
  const inbox = useInboxShared();
  const { state, active, enable } = usePushDevice(inbox?.push.publicKey ?? null);
  const [message, setMessage] = useState<ActionResult | null>(null);
  const [pending, setPending] = useState(false);
  if (!inbox) return null;
  const { muted, canMute } = inbox.push;

  async function run(task: () => Promise<ActionResult>) {
    setPending(true);
    const result = await task();
    setPending(false);
    setMessage(result);
    if (!result.error) router.reload({ only: ["inbox"] });
  }

  let status: React.ReactNode;
  if (canMute && muted) {
    status = <span className="flex items-center gap-2 text-muted"><BellIcon off /> Notificaciones desactivadas</span>;
  } else if (active) {
    status = <span className="flex items-center gap-2 text-emerald-700"><BellIcon /> Notificaciones activas en este dispositivo</span>;
  } else if (state === "denied") {
    status = <span className="flex items-center gap-2 text-red-700"><BellIcon off /> Bloqueadas en este navegador</span>;
  } else if (state === "unsupported") {
    status = <span className="flex items-center gap-2 text-muted"><BellIcon off /> {isIos() ? "En iPhone: Compartir → Agregar a inicio, y abre el panel desde ese ícono" : "Este navegador no recibe notificaciones"}</span>;
  } else {
    status = (
      <button type="button" disabled={pending} onClick={() => run(enable)} className="flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-xs font-semibold text-white disabled:opacity-60">
        <BellIcon /> {pending ? "Activando…" : "Activar notificaciones en este dispositivo"}
      </button>
    );
  }

  return (
    <div className="flex flex-col items-start gap-2 lg:items-end">
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-white px-4 py-2.5 text-[13px] font-medium">
        {status}
        {canMute && (
          <label className="flex cursor-pointer items-center gap-2 border-l border-line pl-3 text-xs font-semibold text-muted">
            <span>{muted ? "Apagadas" : "Encendidas"}</span>
            <input
              type="checkbox"
              role="switch"
              checked={!muted}
              disabled={pending}
              onChange={(event) => run(() => setMuted(!event.target.checked))}
              className="peer sr-only"
            />
            <span className="relative h-5 w-9 rounded-full bg-line transition after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow after:transition peer-checked:bg-emerald-600 peer-checked:after:translate-x-4 peer-focus-visible:ring-2 peer-focus-visible:ring-ink/30" aria-hidden="true" />
          </label>
        )}
      </div>
      {state === "denied" && !(canMute && muted) && (
        <p className="max-w-sm text-[12px] leading-5 text-muted lg:text-right">Para activarlas toca el candado junto a la dirección de la página → Notificaciones → Permitir, y recarga.</p>
      )}
      {message && (message.error || message.message) && (
        <p className={`max-w-sm text-[12px] leading-5 lg:text-right ${message.error ? "text-red-700" : "text-emerald-700"}`}>{message.error || message.message}</p>
      )}
    </div>
  );
}
