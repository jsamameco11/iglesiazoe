import { router } from "@inertiajs/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { BEDS, Broadcaster, ProgramPlayer, postForm, useServerClock, type Autopilot, type LiveMode, type RadioConfig, type RadioLayer, type RadioState, type RadioTrack, type RadioUpcoming } from "@/lib/radio";

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

export type Snapshot = { radio: RadioState; live: ConsoleLive; voice: number; config: RadioConfig; autopilot: Autopilot; upcoming: RadioUpcoming[] };

/** How to reprogram a block: some minutes later, or at a given time (today unless `date`). */
export type Reschedule = { mode: "shift"; minutes: number } | { mode: "at"; time: string; date?: string };

type Notice = { tone: "error" | "info"; text: string } | null;

/** Microphone of this console: level, music bed while talking, self monitoring, input device and voice processing. */
type MicSettings = { level: number; autoBed: boolean; selfMonitor: boolean; deviceId: string; processing: boolean };

type PlayOptions = { volume?: number; duck?: boolean; fadeIn?: number; fadeOut?: number; loop?: boolean };

/** A stretch of this console's voice on air, for the timeline. */
type TalkSpan = { start: number; end: number | null };

type Signal = Snapshot & { pending: string[]; answers: { id: string; answer: string }[]; alive: string[] };

/**
 * State and engines of the live console: the server snapshot (polled every 1.5 s), the
 * monitor player, the microphone broadcaster and the actions that change what is on air.
 */
export function useConsole(initial: Snapshot, host: string) {
  const serverClock = useServerClock();
  const player = useRef<ProgramPlayer | null>(null);
  const caster = useRef<Broadcaster | null>(null);
  caster.current ??= new Broadcaster();

  const [state, setState] = useState(initial.radio);
  const [live, setLive] = useState(initial.live);
  const [config, setConfig] = useState(initial.config);
  const [autopilot, setAutopilot] = useState(initial.autopilot);
  const [upcoming, setUpcoming] = useState(initial.upcoming ?? []);
  /** Whether audios were waiting for the live transmission: when they go on air, today's list is reloaded. */
  const heldRef = useRef(false);
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
  const [blend, setBlend] = useState(3);
  const [talks, setTalks] = useState<TalkSpan[]>([]);
  const [, force] = useState(0);

  const apply = useCallback((data: Snapshot, broadcast = false) => {
    setState(data.radio);
    setLive(data.live);
    setConfig(data.config);
    if (data.autopilot) setAutopilot(data.autopilot);
    if (data.upcoming) {
      setUpcoming(data.upcoming);
      const holding = data.upcoming.some((block) => block.held);
      if (heldRef.current && !holding) router.reload({ only: ["day"] });
      heldRef.current = holding;
    }
    setVoice(data.voice);
    player.current?.setReserve(data.radio.fallback ?? []);
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
      const data = (await postForm("/admin/radio/capa", payload)) as Snapshot & { ok?: boolean; error?: string; layer?: RadioLayer; stopped?: string[]; faded?: RadioLayer[] };
      if (data.error) {
        setNotice({ tone: "error", text: data.error });
        return null;
      }
      [...(data.faded ?? []), ...(data.layer ? [data.layer] : [])].forEach((item) => {
        const layer = { ...item, source: "live" as const };
        player.current?.pushLayer(layer);
        caster.current?.broadcast({ t: "layer", layer });
      });
      if (data.stopped?.length) {
        player.current?.dropLayers(data.stopped);
        caster.current?.broadcast({ t: "stop", ids: data.stopped });
      }
      if (data.radio) apply(data);
      return data;
    },
    [apply],
  );

  /** Plays a library audio on a lane; on a lane that already sounds, a fade in crossfades with it. */
  const play = useCallback(
    (track: RadioTrack, lane: string, options: PlayOptions = {}) =>
      layerAction({
        action: "play",
        id: track.id,
        lane,
        volume: String(options.volume ?? 100),
        duck: options.duck === undefined ? "" : options.duck ? "1" : "0",
        fade_in: String(options.fadeIn ?? 0),
        fade_out: String(options.fadeOut ?? 0),
        loop: options.loop ? "1" : "0",
      }),
    [layerAction],
  );

  /**
   * A sound dropped or sent to a lane with the console crossfade: beds loop and fade in and
   * out; a player that is already sounding crossfades into the new audio; pads just fire.
   */
  const drop = useCallback(
    (track: RadioTrack, lane: string) => {
      const bed = (BEDS as readonly string[]).includes(lane);
      const at = serverClock.now();
      const sounding = lane !== "pad" && state.layers.some((layer) => layer.source === "live" && layer.lane === lane && !layer.fading && layer.start <= at && at < layer.end);
      return play(track, lane, { fadeIn: bed || sounding ? blend : 0, fadeOut: bed ? blend : 0, loop: bed });
    },
    [play, state.layers, blend, serverClock],
  );

  /** Stops a layer, a lane or every console sound: cut at once, or faded out over some seconds. */
  const stop = useCallback(
    (target: { lane?: string; layer?: string }, seconds = 0) =>
      layerAction({ action: "stop", ...(target.lane ? { lane: target.lane } : {}), ...(target.layer ? { layer: target.layer } : {}), ...(seconds > 0 ? { fade: String(seconds) } : {}) }),
    [layerAction],
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
    player.current.setReserve(state.fallback ?? []);
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
    const at = serverClock.now();
    setTalks((list) => list.map((span) => (span.end === null ? { ...span, end: at } : span)));
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
    const at = serverClock.now();
    setTalks((list) => (next ? [...list.slice(-30), { start: at, end: null }] : list.map((span) => (span.end === null ? { ...span, end: at } : span))));
    await liveAction(mic.autoBed ? { action: "mix", mic: next ? "1" : "0", bed: next ? "1" : "0" } : { action: "mix", mic: next ? "1" : "0" });
  }

  async function toggleAir() {
    const on = !config.on_air;
    if (!on && !window.confirm("¿Sacar la radio del aire? Los oyentes dejarán de escuchar la programación.")) return;
    await liveAction({ action: "air", on: on ? "1" : "0" }, false);
  }

  const musicAction = useCallback(
    async (payload: Record<string, string>) => {
      const data = (await postForm("/admin/radio/musica-continua", payload)) as Snapshot & { ok?: boolean; error?: string; message?: string };
      if (data.error) setNotice({ tone: "error", text: data.error });
      else if (data.ok) {
        apply(data);
        if (data.message) setNotice({ tone: "info", text: data.message });
      }
    },
    [apply],
  );

  /** Pauses or resumes the continuous music that fills the gaps of the program. */
  async function toggleAutofill() {
    const on = !config.autofill;
    if (!on && !window.confirm("¿Pausar la música continua? Los espacios sin programación quedarán en silencio hasta que la reanudes.")) return;
    await musicAction({ action: "autofill", on: on ? "1" : "0" });
  }

  /** Takes the song on air out of the continuous music: it fades out now and does not repeat. */
  async function dropFromRotation(trackId: string, title: string) {
    if (!window.confirm(`¿Sacar «${title}» de la música automática?\n\nDeja de sonar ahora, sale de sus listas y no se repetirá. Puedes volver a incluirla cuando quieras desde Listas o la Biblioteca.`)) return;
    await musicAction({ action: "drop", id: trackId });
  }

  /** Changes what the automatic music plays (a Spotify playlist when `spotify` is set); it lands on a song boundary after the lead time. */
  async function switchSource(playlist: string, shuffle: boolean, spotify = "") {
    await musicAction({ action: "source", playlist, shuffle: shuffle ? "1" : "0", ...(spotify ? { spotify } : {}) });
  }

  /** Calls off a scheduled change of the automatic music. */
  async function cancelSwitch() {
    await musicAction({ action: "cancel" });
  }

  /** «Ir al vivo»: cuts the automatic music for every listener until the operator returns. */
  async function cutMusic() {
    await musicAction({ action: "cut", on: "1" });
  }

  /** Back to the automatic music right away, optionally with another playlist or order. */
  async function resumeMusic(source?: { playlist: string; shuffle: boolean; spotify?: string }) {
    await musicAction({
      action: "cut",
      on: "0",
      ...(source ? { playlist: source.playlist, shuffle: source.shuffle ? "1" : "0", ...(source.spotify ? { spotify: source.spotify } : {}) } : {}),
    });
  }

  async function setLiveMode(mode: LiveMode) {
    await musicAction({ action: "mode", mode });
  }

  /** Moves a scheduled block of the main program; true when it was moved. */
  async function reschedule(id: string, change: Reschedule) {
    const payload: Record<string, string> =
      change.mode === "shift" ? { id, mode: "shift", minutes: String(change.minutes) } : { id, mode: "at", time: change.time, ...(change.date ? { date: change.date } : {}) };
    const data = (await postForm("/admin/radio/reprogramar", payload)) as Snapshot & { ok?: boolean; error?: string; message?: string };
    if (data.error) {
      setNotice({ tone: "error", text: data.error });
      return false;
    }
    apply(data);
    if (data.message) setNotice({ tone: "info", text: data.message });
    router.reload({ only: ["day"] });
    return true;
  }

  return {
    state,
    live,
    config,
    autopilot,
    upcoming,
    reschedule,
    switchSource,
    cancelSwitch,
    cutMusic,
    resumeMusic,
    setLiveMode,
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
    play,
    drop,
    stop,
    blend,
    setBlend,
    talks,
    toggleMonitor,
    changeMonitorLevel,
    openMic,
    startLive,
    stopLive,
    toggleTalk,
    toggleAir,
    toggleAutofill,
    dropFromRotation,
  };
}

export type ConsoleApi = ReturnType<typeof useConsole>;
