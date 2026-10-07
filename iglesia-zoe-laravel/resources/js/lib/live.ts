import { usePage } from "@inertiajs/react";
import { useEffect, useState } from "react";

/** The EN VIVO button and the countdown open Prédicas: the live service when on air, otherwise the latest one. */
export const LIVE_HREF = "/predicas#en-vivo";

export type LiveState = {
  live: boolean;
  signal?: boolean;
  title?: string;
  description?: string | null;
  preacher?: string | null;
  kind?: "predica" | "gc";
  started_at?: string | null;
  youtube_id?: string | null;
  player?: string;
  cover?: string | null;
};

/** True while the church is broadcasting right now (shared with every page). */
export function useOnAir() {
  const { onAir } = usePage().props as unknown as { onAir?: boolean };
  return Boolean(onAir);
}

/** Live state that keeps itself fresh while the page is open; pauses in background tabs. */
export function useLiveState(initial: LiveState, everyMs = 20000) {
  const [state, setState] = useState(initial);

  useEffect(() => setState(initial), [initial]);

  useEffect(() => {
    let stopped = false;
    async function refresh() {
      if (document.hidden) return;
      try {
        const response = await fetch("/en-vivo/estado", { headers: { Accept: "application/json" } });
        if (response.ok && !stopped) setState((await response.json()) as LiveState);
      } catch {
        // Keeps the last known state when the network blips.
      }
    }
    const id = window.setInterval(refresh, everyMs);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      stopped = true;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [everyMs]);

  return state;
}

/** "1 h 05 min" from seconds. */
export function formatDuration(seconds: number | null | undefined) {
  if (!seconds || seconds < 60) return "";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours ? `${hours} h ${String(minutes).padStart(2, "0")} min` : `${minutes} min`;
}
