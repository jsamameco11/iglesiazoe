import { useCallback, useEffect, useRef, useState } from "react";
import { Broadcaster, ProgramPlayer, ServerClock, postForm, type RadioConfig, type RadioLayer, type RadioState } from "@/lib/radio";

export type ConsoleLive = {
  session: string | null;
  host: string;
  started_at: number | null;
  music: number;
  overlay: number;
  muted: boolean;
  bed: boolean;
  mic: boolean;
  rev: number;
};

export type Snapshot = { radio: RadioState; live: ConsoleLive; voice: number; config: RadioConfig };

export type Notice = { tone: "error" | "info"; text: string } | null;

/** Microphone of this console: level, music bed while talking, self monitoring, input device and voice processing. */
export type MicSettings = { level: number; autoBed: boolean; selfMonitor: boolean; deviceId: string; processing: boolean };

type Signal = Snapshot & { pending: string[]; answers: { id: string; answer: string }[]; alive: string[] };

/**
 * State and engines of the live console: the server snapshot (polled every 1.5 s), the
 * monitor player, the microphone broadcaster and the actions that change what is on air.
 */
export function useConsole(initial: Snapshot, host: string) {
  const clockRef = useRef<ServerClock | null>(null);
  clockRef.current ??= new ServerClock();
  const serverClock = clockRef.current;
  const player = useRef<ProgramPlayer | null>(null);
  const caster = useRef<Broadcaster | null>(null);
  caster.current ??= new Broadcaster();

  const [state, setState] = useState(initial.radio);
  const [live, setLive] = useState(initial.live);
  const [config, setConfig] = useState(initial.config);
  const [voice, setVoice] = useState(initial.voice);
  const [now, setNow] = useState(initial.radio.now);
  const [notice, setNotice] = useState<Notice>(null);
  const [monitor, setMonitor] = useState(false);
  const [monitorLevel, setMonitorLevel] = useState(0.8);
  const [micOpen, setMicOpen] = useState(false);
  const [mic, setMic] = useState<MicSettings>({ level: 1, autoBed: true, selfMonitor: false, deviceId: "", processing: true });
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [talking, setTalking] = useState(false);
  const [hostName, setHostName] = useState(initial.live.host || host);
  const [busy, setBusy] = useState(false);
  const [, force] = useState(0);

  const apply = useCallback((data: Snapshot, broadcast = false) => {
    setState(data.radio);
    setLive(data.live);
    setConfig(data.config);
    setVoice(data.voice);
    player.current?.setQueue(data.radio.queue);
    player.current?.setMix(data.radio.mix);
    player.current?.setLayers(data.radio.layers);
    if (broadcast) caster.current?.broadcast({ t: "mix", mix: data.radio.mix, rev: data.live.rev });
  }, []);

  useEffect(() => {
    if (live.session && live.host) setHostName(live.host);
  }, [live.session]);

  useEffect(() => {
    serverClock.seed(initial.radio.now);
    const timer = window.setInterval(() => setNow(serverClock.now()), 250);
    return () => window.clearInterval(timer);
  }, [initial.radio.now, serverClock]);

  useEffect(() => {
    let stop = false;
    let timer = 0;
    const loop = async () => {
      const sent = Date.now();
      try {
        const res = await fetch("/admin/radio/senal", { headers: { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" }, cache: "no-store" });
        if (res.ok) {
          const data = (await res.json()) as Signal;
          serverClock.sample(data.radio.now, sent, Date.now());
          apply(data);
          const mic = caster.current;
          if (data.live.session && mic?.open) {
            await mic.accept(data.answers);
            if (data.pending.length) void mic.serve(data.pending, data.radio.ice);
            mic.prune(data.alive);
          }
          if (!data.live.session && mic?.peers.size) mic.dropAll();
          force((value) => value + 1);
        }
      } catch {
        /* network hiccup: try again */
      }
      if (!stop) timer = window.setTimeout(loop, 1500);
    };
    void loop();
    return () => {
      stop = true;
      window.clearTimeout(timer);
    };
  }, [apply, serverClock]);

  useEffect(
    () => () => {
      player.current?.stop();
      caster.current?.shutdown();
    },
    [],
  );

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (caster.current?.open) event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  const liveAction = useCallback(
    async (payload: Record<string, string>, broadcast = true) => {
      const data = (await postForm("/admin/radio/vivo", payload)) as Snapshot & { ok?: boolean; error?: string };
      if (data.error) {
        setNotice({ tone: "error", text: data.error });
        return null;
      }
      if (data.ok) apply(data, broadcast);
      return data;
    },
    [apply],
  );

  /** Plays, stops or adjusts a sound on top of the program and tells connected listeners right away. */
  const layerAction = useCallback(
    async (payload: Record<string, string>) => {
      const data = (await postForm("/admin/radio/capa", payload)) as Snapshot & { ok?: boolean; error?: string; layer?: RadioLayer; stopped?: string[] };
      if (data.error) {
        setNotice({ tone: "error", text: data.error });
        return null;
      }
      if (data.layer) {
        const layer = { ...data.layer, source: "live" as const };
        player.current?.pushLayer(layer);
        caster.current?.broadcast({ t: "layer", layer });
      }
      if (data.stopped?.length) {
        player.current?.dropLayers(data.stopped);
        caster.current?.broadcast({ t: "stop", ids: data.stopped });
      }
      if (data.radio) apply(data);
      return data;
    },
    [apply],
  );

  async function toggleMonitor() {
    if (monitor) {
      player.current?.stop();
      setMonitor(false);
      return;
    }
    player.current ??= new ProgramPlayer(serverClock);
    await player.current.start();
    player.current.setVolume(monitorLevel);
    player.current.setQueue(state.queue);
    player.current.setMix(state.mix);
    player.current.setLayers(state.layers);
    setMonitor(true);
  }

  function changeMonitorLevel(value: number) {
    setMonitorLevel(value);
    player.current?.setVolume(value);
  }

  async function openMic() {
    try {
      await caster.current!.openMic(mic.deviceId || null, mic.processing);
      caster.current!.setLevel(mic.level);
      caster.current!.setTalking(talking);
      caster.current!.setReturn(mic.selfMonitor);
      setMicOpen(true);
      const list = await navigator.mediaDevices.enumerateDevices();
      setDevices(list.filter((device) => device.kind === "audioinput"));
      return true;
    } catch {
      setNotice({ tone: "error", text: "No pudimos usar el micrófono. Permite el acceso al micrófono en el navegador (ícono del candado junto a la dirección) e inténtalo otra vez." });
      return false;
    }
  }

  function changeMic(next: Partial<MicSettings>) {
    const merged = { ...mic, ...next };
    setMic(merged);
    if (next.level !== undefined) caster.current?.setLevel(next.level);
    if (next.selfMonitor !== undefined) caster.current?.setReturn(next.selfMonitor);
  }

  async function startLive() {
    setBusy(true);
    setNotice(null);
    if (await openMic()) {
      const data = await liveAction({ action: "start", host: hostName });
      if (data) setNotice({ tone: "info", text: "¡Estás en vivo! Presiona «Hablar» cuando quieras salir al aire con tu voz." });
    }
    setBusy(false);
  }

  async function stopLive() {
    if (!window.confirm("¿Terminar la transmisión en vivo? La programación sigue sonando.")) return;
    setBusy(true);
    caster.current?.setTalking(false);
    setTalking(false);
    await liveAction({ action: "stop" }, false);
    caster.current?.dropAll();
    caster.current?.closeMic();
    setMicOpen(false);
    setBusy(false);
    setNotice(null);
  }

  async function toggleTalk() {
    const next = !talking;
    caster.current?.setTalking(next);
    setTalking(next);
    await liveAction(mic.autoBed ? { action: "mix", mic: next ? "1" : "0", bed: next ? "1" : "0" } : { action: "mix", mic: next ? "1" : "0" });
  }

  async function toggleAir() {
    const on = !config.on_air;
    if (!on && !window.confirm("¿Sacar la radio del aire? Los oyentes dejarán de escuchar la programación.")) return;
    await liveAction({ action: "air", on: on ? "1" : "0" }, false);
  }

  return {
    state,
    live,
    config,
    voice,
    now,
    notice,
    setNotice,
    monitor,
    monitorLevel,
    micOpen,
    mic,
    devices,
    changeMic,
    talking,
    hostName,
    setHostName,
    busy,
    player,
    caster,
    liveAction,
    layerAction,
    toggleMonitor,
    changeMonitorLevel,
    openMic,
    startLive,
    stopLive,
    toggleTalk,
    toggleAir,
  };
}

export type ConsoleApi = ReturnType<typeof useConsole>;
