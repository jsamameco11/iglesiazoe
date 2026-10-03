import { useCallback, useEffect, useRef, useState } from "react";
import type { RadioEpisode } from "@/lib/radio";

/** On-demand player of /radio: plays one episode at a time, with seeking and the phone's lock-screen controls. */
export function useEpisode(volume: number) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [episode, setEpisode] = useState<RadioEpisode | null>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [length, setLength] = useState(0);
  const [blocked, setBlocked] = useState(false);

  const element = useCallback(() => {
    if (!audio.current) {
      const next = new Audio();
      next.preload = "metadata";
      next.ontimeupdate = () => setTime(next.currentTime);
      next.ondurationchange = () => Number.isFinite(next.duration) && next.duration > 0 && setLength(next.duration);
      next.onplay = () => setPlaying(true);
      next.onpause = () => setPlaying(false);
      next.onended = () => setPlaying(false);
      audio.current = next;
    }
    return audio.current;
  }, []);

  useEffect(() => () => audio.current?.pause(), []);

  useEffect(() => {
    if (audio.current) audio.current.volume = volume;
  }, [volume]);

  const seek = useCallback((seconds: number) => {
    const current = audio.current;
    if (current) current.currentTime = Math.max(0, Math.min(seconds, Number.isFinite(current.duration) ? current.duration : seconds));
  }, []);

  const skip = useCallback((delta: number) => seek((audio.current?.currentTime ?? 0) + delta), [seek]);

  const pause = useCallback(() => audio.current?.pause(), []);

  /** Plays `next`, or pauses and resumes the current episode when it is the same one. */
  const toggle = useCallback(
    (next: RadioEpisode) => {
      if (!next.src) return;
      const current = element();
      if (episode?.id === next.id && !current.paused) {
        current.pause();
        return;
      }
      if (episode?.id !== next.id) {
        current.src = next.src;
        current.volume = volume;
        setEpisode(next);
        setTime(0);
        setLength(next.duration);
      }
      setBlocked(false);
      current.play().catch(() => setBlocked(true));
    },
    [element, episode, volume],
  );

  /** Leaves on-demand listening so the deck shows the live radio again. */
  const close = useCallback(() => {
    audio.current?.pause();
    setEpisode(null);
  }, []);

  useEffect(() => {
    if (!episode || typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: episode.title,
      artist: episode.program ?? "Radio Zoe",
      artwork: episode.cover ? [{ src: episode.cover, sizes: "512x512" }] : [],
    });
    navigator.mediaSession.setActionHandler("play", () => void audio.current?.play());
    navigator.mediaSession.setActionHandler("pause", () => audio.current?.pause());
    navigator.mediaSession.setActionHandler("seekbackward", () => skip(-15));
    navigator.mediaSession.setActionHandler("seekforward", () => skip(30));
    return () => {
      for (const action of ["play", "pause", "seekbackward", "seekforward"] as const) navigator.mediaSession.setActionHandler(action, null);
    };
  }, [episode, skip]);

  return { episode, playing, time, length, blocked, toggle, pause, seek, skip, close };
}

export type EpisodePlayer = ReturnType<typeof useEpisode>;
