import type { RadioItem } from "./types";

/** The item on air; during a crossfade, the song coming in. */
export function currentItem(queue: RadioItem[], now: number) {
  let found: RadioItem | null = null;
  for (const item of queue) if (item.start <= now && now < item.end) found = item;
  return found;
}
