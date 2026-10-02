import { router, usePage } from "@inertiajs/react";
import { useEffect, useSyncExternalStore } from "react";
import { send, type ActionResult } from "@/lib/actions";

export type InboxKind = "visitas" | "bautismos" | "oraciones" | "servidores";

export type InboxShared = {
  unread: Partial<Record<InboxKind, number>>;
  push: { publicKey: string | null; muted: boolean; canMute: boolean };
} | null;

export function useInboxShared() {
  return (usePage().props as unknown as { inbox?: InboxShared }).inbox ?? null;
}

/* Unread counts shared by the sidebar badges and the pages, refreshed live. */
let unread: Partial<Record<InboxKind, number>> = {};
const listeners = new Set<() => void>();

function setUnread(next: Partial<Record<InboxKind, number>>) {
  unread = next;
  listeners.forEach((listener) => listener());
}

export function useUnread(initial: Partial<Record<InboxKind, number>> | undefined) {
  useEffect(() => {
    if (initial) setUnread(initial);
  }, [initial]);
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => unread,
    () => unread,
  );
}

const PULSE_MS = 25000;

/** Polls for new submissions and refreshes the open tab when one arrives. */
export function useInboxPulse(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    let alive = true;

    async function pulse() {
      if (document.visibilityState !== "visible") return;
      try {
        const response = await fetch("/admin/formularios/novedades", { headers: { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" } });
        if (!response.ok || !alive) return;
        const data = (await response.json()) as { unread: Partial<Record<InboxKind, number>> };
        const open = window.location.pathname.match(/^\/admin\/formularios\/(visitas|bautismos|oraciones|servidores)$/)?.[1] as InboxKind | undefined;
        if (open && (data.unread[open] ?? 0) > 0) {
          router.reload({ only: ["rows", "seenBefore", "inbox"] });
          return;
        }
        setUnread(data.unread);
      } catch {
        /* offline: try again on the next tick */
      }
    }

    const timer = window.setInterval(pulse, PULSE_MS);
    const onVisible = () => document.visibilityState === "visible" && pulse();
    const onMessage = (event: MessageEvent) => event.data?.type === "zoe:inbox" && pulse();
    document.addEventListener("visibilitychange", onVisible);
    navigator.serviceWorker?.addEventListener("message", onMessage);
    return () => {
      alive = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      navigator.serviceWorker?.removeEventListener("message", onMessage);
    };
  }, [enabled]);
}

/* Web Push: Chrome on Android delivers these through Google's push service. */

export type PushState = "unsupported" | "default" | "denied" | "granted";

function pushSupported() {
  return typeof window !== "undefined" && window.isSecureContext && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export function pushPermission(): PushState {
  if (!pushSupported()) return "unsupported";
  return Notification.permission as PushState;
}

export function isIos() {
  return typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function keyBytes(base64: string) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
}

function sameKey(subscription: PushSubscription, publicKey: string) {
  const current = subscription.options.applicationServerKey;
  if (!current) return false;
  const a = new Uint8Array(current);
  const b = keyBytes(publicKey);
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

async function registration() {
  await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  return navigator.serviceWorker.ready;
}

async function subscription(publicKey: string) {
  const worker = await registration();
  let current = await worker.pushManager.getSubscription();
  if (current && !sameKey(current, publicKey)) {
    await current.unsubscribe();
    current = null;
  }
  return current ?? worker.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) });
}

async function register(current: PushSubscription): Promise<ActionResult> {
  const json = current.toJSON();
  const encodings = (PushManager as unknown as { supportedContentEncodings?: string[] }).supportedContentEncodings ?? ["aes128gcm"];
  return send("/admin/notificaciones/suscribir", {
    endpoint: json.endpoint ?? current.endpoint,
    "keys[p256dh]": json.keys?.p256dh ?? "",
    "keys[auth]": json.keys?.auth ?? "",
    contentEncoding: encodings.includes("aes128gcm") ? "aes128gcm" : "aesgcm",
  });
}

/** Asks for permission (needs a tap) and registers this device. */
export async function enablePush(publicKey: string | null): Promise<ActionResult> {
  if (!publicKey || !pushSupported()) return { error: "Este navegador no permite notificaciones. En Android usa Google Chrome." };
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return { error: "No se activaron. Toca el candado junto a la dirección de la página → Notificaciones → Permitir, y vuelve a intentarlo." };
  }
  try {
    const result = await register(await subscription(publicKey));
    if (!result.error) {
      synced = { key: publicKey, done: Promise.resolve(true) };
      window.dispatchEvent(new Event(PUSH_CHANGED));
    }
    return result;
  } catch {
    return { error: "No pudimos activar las notificaciones en este dispositivo. Recarga la página e inténtalo otra vez." };
  }
}

export const PUSH_CHANGED = "zoe:push-changed";

let synced: { key: string; done: Promise<boolean> } | null = null;

/** Keeps an already allowed device registered for the account that is signed in (once per page load). */
export function syncPush(publicKey: string | null): Promise<boolean> {
  if (!publicKey || pushPermission() !== "granted") return Promise.resolve(false);
  if (synced?.key !== publicKey) {
    synced = {
      key: publicKey,
      done: subscription(publicKey)
        .then(register)
        .then((result) => !result.error)
        .catch(() => false),
    };
  }
  return synced.done;
}

export async function setMuted(muted: boolean) {
  return send("/admin/notificaciones/silenciar", { muted: muted ? "1" : "0" });
}
