import type { RadioItem } from "./types";

/** The item on air; during a crossfade, the song coming in. */
export function currentItem(queue: RadioItem[], now: number) {
  let found: RadioItem | null = null;
  for (const item of queue) if (item.start <= now && now < item.end) found = item;
  return found;
}

/** The item after the one on air (the next song starts when this one fades out). */
export function nextItem(queue: RadioItem[], now: number) {
  const current = currentItem(queue, now);
  return queue.find((item) => item.start > now && item.id !== current?.id) ?? null;
}
