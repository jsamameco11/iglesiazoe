import type { RadioItem, RadioState } from "./types";

/** The item on air; during a crossfade, the song coming in. */
export function currentItem(queue: RadioItem[], now: number) {
  let found: RadioItem | null = null;
  for (const item of queue) if (item.start <= now && now < item.end) found = item;
  return found;
}

/** A song listeners must not see named: the station hides song names and the item is music (also the music under a live show). */
export function hidesSong(state: Pick<RadioState, "show_titles">, item: Pick<RadioItem, "kind" | "bed">) {
  return state.show_titles === false && (item.kind === "musica" || item.kind === "automatica" || (item.kind === "vivo" && item.bed));
}
