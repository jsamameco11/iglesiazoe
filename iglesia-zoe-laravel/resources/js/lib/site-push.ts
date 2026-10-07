import { useEffect, useState } from "react";
import { send, type ActionResult } from "@/lib/actions";
import { isIos, pushSupported, subscription, subscriptionFields } from "@/lib/inbox";

/* Visitors' notices: Radio Zoe programs about to start, live services and new sermons. */

export type SitePushStatus = "loading" | "on" | "off" | "denied" | "ios" | "unsupported";

const CHANGED = "zoe:site-push-changed";

function installedOnIos() {
  return (navigator as Navigator & { standalone?: boolean }).standalone === true || window.matchMedia("(display-mode: standalone)").matches;
}

async function currentSubscription() {
  const worker = await navigator.serviceWorker.getRegistration("/");
  return (await worker?.pushManager.getSubscription()) ?? null;
}

async function serverKey() {
  const response = await fetch("/notificaciones/clave", { headers: { Accept: "application/json" } });
  if (!response.ok) return null;
  return ((await response.json()) as { publicKey?: string | null }).publicKey ?? null;
}

async function readStatus(): Promise<SitePushStatus> {
  if (!pushSupported()) return isIos() && !installedOnIos() ? "ios" : "unsupported";
  if (Notification.permission === "denied") return "denied";
  if (Notification.permission !== "granted") return "off";
  return (await currentSubscription().catch(() => null)) ? "on" : "off";
}

let resynced = false;

/** Keeps an allowed browser known to the server once per page load (its key may have been renewed). */
async function resync() {
  if (resynced) return;
  resynced = true;
  try {
    const key = await serverKey();
    if (key && (await currentSubscription())) await send("/notificaciones", subscriptionFields(await subscription(key)));
  } catch {
    /* tried again on the next visit */
  }
}

async function turnOn(): Promise<ActionResult> {
  if (!pushSupported()) return { error: "Este navegador no permite notificaciones. Prueba con Chrome, Edge o Firefox." };
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return { error: "No se activaron. Toca el candado junto a la dirección de la página → Notificaciones → Permitir, y vuelve a intentarlo." };
  }
  try {
    const key = await serverKey();
    if (!key) return { error: "Las notificaciones no están disponibles en este momento. Inténtalo más tarde." };
    return await send("/notificaciones", subscriptionFields(await subscription(key)));
  } catch {
    return { error: "No pudimos activarlas en este dispositivo. Recarga la página e inténtalo otra vez." };
  }
}

async function turnOff(): Promise<ActionResult> {
  try {
    const current = await currentSubscription();
    if (!current) return { ok: true };
    const endpoint = current.endpoint;
    await current.unsubscribe();
    return await send("/notificaciones/quitar", { endpoint });
  } catch {
    return { error: "No pudimos desactivarlas. Recarga la página e inténtalo otra vez." };
  }
}

/** State and actions of the notifications of this browser, in step across every bell on the page. */
export function useSitePush() {
  const [status, setStatus] = useState<SitePushStatus>("loading");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);

  useEffect(() => {
    const refresh = () => readStatus().then((next) => {
      setStatus(next);
      if (next === "on") resync();
    });
    refresh();
    window.addEventListener(CHANGED, refresh);
    return () => window.removeEventListener(CHANGED, refresh);
  }, []);

  async function run(action: () => Promise<ActionResult>) {
    setBusy(true);
    setMessage(null);
    const result = await action();
    setBusy(false);
    setMessage(result.error ? { text: result.error, error: true } : result.message ? { text: String(result.message) } : null);
    window.dispatchEvent(new Event(CHANGED));
  }

  return { status, busy, message, enable: () => run(turnOn), disable: () => run(turnOff) };
}
