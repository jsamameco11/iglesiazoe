import { useState, type DragEvent } from "react";
import type { RadioTrack } from "@/lib/radio";

const MIME = "application/x-zoe-track";

export function dragTrack(event: DragEvent, track: RadioTrack) {
  event.dataTransfer.setData(MIME, track.id);
  event.dataTransfer.setData("text/plain", track.title);
  event.dataTransfer.effectAllowed = "copy";
}

/** Props for an element that accepts library audios dropped on it; `data-drop` lights it while one hovers. */
export function useTrackDrop(library: RadioTrack[], onTrack: (track: RadioTrack) => void) {
  const [over, setOver] = useState(false);

  return {
    "data-drop": over || undefined,
    onDragOver(event: DragEvent) {
      if (!event.dataTransfer.types.includes(MIME)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
      setOver(true);
    },
    onDragLeave(event: DragEvent) {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOver(false);
    },
    onDrop(event: DragEvent) {
      setOver(false);
      const track = library.find((item) => item.id === event.dataTransfer.getData(MIME));
      if (!track) return;
      event.preventDefault();
      onTrack(track);
    },
  };
}
