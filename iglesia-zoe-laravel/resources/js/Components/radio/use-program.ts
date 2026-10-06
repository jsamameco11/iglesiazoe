import { useEffect, useState } from "react";
import type { RadioItem } from "@/lib/radio";

/** One item of what will sound: a song of the automatic music, a scheduled audio or a live block. */
export type ProgramItem = Pick<RadioItem, "id" | "kind" | "title" | "artist" | "start" | "end" | "origin" | "bed" | "block" | "slot" | "track">;

/**
 * What will sound from `from` to `to` (at most 36 h), song by song, as the listeners will hear
 * it. Loaded again when the range or `version` changes and every `every` ms; null while it
 * loads the first time or when `from` is null.
 */
export function useProgram(from: number | null, to: number, version: string, every = 60_000) {
  const [items, setItems] = useState<ProgramItem[] | null>(null);

  useEffect(() => {
    if (from === null) {
      setItems(null);
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`/admin/radio/linea?desde=${Math.round(from)}&hasta=${Math.round(to)}`, {
          headers: { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" },
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = (await res.json()) as { items?: ProgramItem[] };
        if (!cancelled && data.items) setItems(data.items);
      } catch {
        /* the next round tries again */
      }
    };
    void load();
    const timer = window.setInterval(load, every);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [from, to, version, every]);

  return items;
}
