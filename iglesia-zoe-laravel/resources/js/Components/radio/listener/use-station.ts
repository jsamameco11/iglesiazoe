import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ProgramPlayer, ServerClock, VoiceLink, newListenerId, type RadioState } from "@/lib/radio";

/** Listener engine: polls the station, follows its clock, mixes the program and the live voice. */
export function useStation(initial: RadioState) {
  const clockRef = useRef<ServerClock | null>(null);
  clockRef.current ??= new ServerClock();
  const serverClock = clockRef.current;
  const player = useRef<ProgramPlayer | null>(null);
  const voice = useRef<VoiceLink | null>(null);
  const stream = useRef<HTMLAudioElement | null>(null);
  const rev = useRef(initial.live.rev);
  const playingRef = useRef(false);
  const [state, setState] = useState(initial);
  const [now, setNow] = useState(initial.now);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolumeState] = useState(0.9);
  const [voiceStatus, setVoiceStatus] = useState<VoiceLink["status"]>("off");
  const [blocked, setBlocked] = useState(false);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const listener = useMemo(() => (typeof window === "undefined" ? "" : newListenerId()), []);

  useEffect(() => {
    serverClock.seed(initial.now);
    setNow(serverClock.now());
    const timer = window.setInterval(() => setNow(serverClock.now()), 500);
    return () => window.clearInterval(timer);
  }, [initial.now, serverClock]);

  const apply = useCallback((next: RadioState) => {
    setState(next);
    const engine = player.current;
    if (engine) {
      engine.setQueue(next.queue);
      if (next.live.rev >= rev.current) {
        rev.current = next.live.rev;
        engine.setMix(next.mix);
      }
      engine.setLayers(next.layers);
    }
    if (playingRef.current && !next.stream) void voice.current?.update(next);
  }, []);

  const poll = useCallback(async () => {
    const sent = Date.now();
    try {
      const res = await fetch(`/radio/estado${playingRef.current ? `?oyente=${listener}` : ""}`, { headers: { Accept: "application/json" }, cache: "no-store" });
      if (!res.ok) return null;
      const next = (await res.json()) as RadioState;
      serverClock.sample(next.now, sent, Date.now());
      apply(next);
      return next;
    } catch {
      return null;
    }
  }, [apply, listener, serverClock]);

  useEffect(() => {
    let stop = false;
    let timer = 0;
    const loop = async () => {
      const next = await poll();
      if (stop) return;
      const negotiating = next?.voice && ["waiting", "offering", "offered"].includes(next.voice.state);
      const delay = !playingRef.current ? 12000 : negotiating ? 1000 : 2500;
      timer = window.setTimeout(loop, delay);
    };
    timer = window.setTimeout(loop, playing ? 50 : 12000);
    return () => {
      stop = true;
      window.clearTimeout(timer);
    };
  }, [playing, poll]);

  const leave = useCallback(() => {
    const body = new FormData();
    body.set("oyente", listener);
    body.set("_token", document.querySelector('meta[name="csrf-token"]')?.getAttribute("content") || "");
    navigator.sendBeacon?.("/radio/salir", body);
  }, [listener]);

  useEffect(() => {
    const onHide = () => playingRef.current && leave();
    window.addEventListener("pagehide", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
      player.current?.stop();
      voice.current?.close();
      stream.current?.pause();
      if (playingRef.current) leave();
    };
  }, [leave]);

  const toggle = useCallback(async () => {
    if (playingRef.current) {
      playingRef.current = false;
      setPlaying(false);
      player.current?.stop();
      voice.current?.close();
      stream.current?.pause();
      setAnalyser(null);
      leave();
      return;
    }
    setBlocked(false);
    if (state.stream) {
      stream.current ??= new Audio();
      stream.current.src = state.stream;
      stream.current.volume = volume;
      await stream.current.play().catch(() => setBlocked(true));
    } else {
      if (!player.current) {
        player.current = new ProgramPlayer(serverClock);
        player.current.onBlocked = () => setBlocked(true);
      }
      if (!voice.current) {
        voice.current = new VoiceLink(listener);
        voice.current.onStatus = setVoiceStatus;
        voice.current.onMix = (mix, at) => {
          if (at >= rev.current) {
            rev.current = at;
            player.current?.setMix(mix);
          }
        };
        voice.current.onLayer = (layer) => player.current?.pushLayer(layer);
        voice.current.onStop = (ids) => player.current?.dropLayers(ids);
      }
      await Promise.all([player.current.start(), voice.current.unlock()]);
      player.current.setVolume(volume);
      voice.current.setVolume(volume);
      player.current.setQueue(state.queue);
      player.current.setMix(state.mix);
      player.current.setLayers(state.layers);
      setAnalyser(player.current.analyser);
    }
    playingRef.current = true;
    setPlaying(true);
  }, [leave, listener, serverClock, state.layers, state.mix, state.queue, state.stream, volume]);

  const setVolume = useCallback((value: number) => {
    setVolumeState(value);
    player.current?.setVolume(value);
    voice.current?.setVolume(value);
    if (stream.current) stream.current.volume = value;
  }, []);

  return { state, now, playing, volume, voice: voiceStatus, blocked, analyser, toggle, setVolume };
}
