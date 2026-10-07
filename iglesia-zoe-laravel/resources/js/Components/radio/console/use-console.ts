import { router } from "@inertiajs/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { BEDS, Broadcaster, ProgramPlayer, postForm, useServerClock, type Autopilot, type LiveMode, type RadioConfig, type RadioLayer, type RadioState, type RadioTrack, type RadioUpcoming, type SwitchTiming } from "@/lib/radio";
import { LiveCapture, type CaptureBrief } from "@/lib/radio/capture";

export type ConsoleLive = {
  session: string | null;
  host: string;
  title: string;
  started_at: number | null;
  music: number;
  overlay: number;
  pads: number;
  muted: boolean;
  bed: boolean;
  mic: boolean;
  rev: number;
};

export type Snapshot = { radio: RadioState; live: ConsoleLive; voice: number; config: RadioConfig; autopilot: Autopilot; upcoming: RadioUpcoming[] };

/** How to reprogram a block: some minutes later, or at a given time (today unless `date`). */
export type Reschedule = { mode: "shift"; minutes: number } | { mode: "at"; time: string; date?: string };

type Notice = { tone: "error" | "info"; text: string } | null;

/**
 * Microphone of this console: level, music bed while talking, self monitoring, input device, voice
 * processing, «Detectar voz» (the program drops while the voice is heard) and «Hablar al iniciar».
 */
type MicSettings = { level: number; autoBed: boolean; selfMonitor: boolean; deviceId: string; processing: boolean; voiceDuck: boolean; talkOnStart: boolean };

const MIC_KEY = "radio.console.mic";

const MIC_DEFAULTS: MicSettings = { level: 1, autoBed: true, selfMonitor: false, deviceId: "", processing: true, voiceDuck: true, talkOnStart: true };

/** The choices of this computer survive a reload (the level and the device are chosen again each time). */
function savedMic(): MicSettings {
  try {
    const saved = JSON.parse(window.localStorage.getItem(MIC_KEY) ?? "{}") as Partial<MicSettings>;
    const pick = (key: "autoBed" | "processing" | "voiceDuck" | "talkOnStart") => (typeof saved[key] === "boolean" ? saved[key] : MIC_DEFAULTS[key]);
    return { ...MIC_DEFAULTS, autoBed: pick("autoBed"), processing: pick("processing"), voiceDuck: pick("voiceDuck"), talkOnStart: pick("talkOnStart") };
  } catch {
    return MIC_DEFAULTS;
  }
}

/** Id of a layer fired here, in the form the server accepts (12 lowercase letters and digits). */
function layerId() {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from(crypto.getRandomValues(new Uint8Array(12)), (byte) => alphabet[byte % alphabet.length]).join("");
}

type PlayOptions = { volume?: number; duck?: boolean; fadeIn?: number; fadeOut?: number; loop?: boolean };

/** A stretch of this console's voice on air, for the timeline. */
type TalkSpan = { start: number; end: number | null };

type Signal = Snapshot & { pending: string[]; answers: { id: string; answer: string }[]; alive: string[] };

/**
 * State and engines of the live console: the server snapshot (polled every 1.5 s), the
 * monitor player, the microphone broadcaster and the actions that change what is on air.
 */
export function useConsole(initial: Snapshot, episode: string, pending: CaptureBrief | null = null) {
  const serverClock = useServerClock();
  const player = useRef<ProgramPlayer | null>(null);
  const caster = useRef<Broadcaster | null>(null);
  const captureEngine = useRef<LiveCapture | null>(null);
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
  const [mic, setMic] = useState<MicSettings>(savedMic);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [talking, setTalking] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [episodeTitle, setEpisodeTitle] = useState(initial.live.title || episode);
  const [busy, setBusy] = useState(false);
  const [blend, setBlend] = useState(3);
  const [talks, setTalks] = useState<TalkSpan[]>([]);
  const [capturing, setCapturing] = useState(false);
  const [capture, setCapture] = useState<CaptureBrief | null>(null);
  const [, force] = useState(0);
  /** Pads fired here that the server has not confirmed yet: they stay on the timeline meanwhile. */
  const firing = useRef<RadioLayer[]>([]);
  const padSounds = useRef<RadioTrack[]>([]);

  const apply = useCallback((data: Snapshot, broadcast = false) => {
    const waiting = firing.current.filter((layer) => !data.radio.layers.some((item) => item.id === layer.id));
    setState(waiting.length ? { ...data.radio, layers: [...data.radio.layers, ...waiting] } : data.radio);
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
    if (live.session && live.title) setEpisodeTitle(live.title);
  }, [live.session]);

  useEffect(() => {
    if (!pending) return;
    let cancel = false;
    (async () => {
      const recording = pending.status === "recording" && pending.stale
        ? (await postForm("/admin/radio/grabacion", { action: "finish", id: pending.id, duration: String(pending.duration ?? 0) })).recording
        : pending.status === "ready"
          ? pending
          : null;
      if (!cancel && recording?.status === "ready") setCapture(recording);
      if (!cancel && pending.status === "recording" && !pending.stale) {
        setNotice({ tone: "info", text: "Hay una grabación en curso en otra pestaña. Déjala terminar allí." });
      }
    })();
    return () => {
      cancel = true;
    };
  }, [pending]);

  useEffect(() => {
    if (!capturing) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [capturing]);

  useEffect(() => {
    const engine = caster.current!;
    engine.setDetect(mic.voiceDuck);
    engine.onVoice = (on) => {
      setSpeaking(on);
      player.current?.setVoice(on);
    };
    return () => {
      engine.onVoice = undefined;
    };
  }, [mic.voiceDuck]);

  useEffect(() => {
    const { autoBed, processing, voiceDuck, talkOnStart } = mic;
    window.localStorage.setItem(MIC_KEY, JSON.stringify({ autoBed, processing, voiceDuck, talkOnStart }));
  }, [mic]);

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

  /**
   * A pad sounds in the monitor and shows on the timeline the instant it is pressed (its audio is
   * already decoded); the server then confirms it with the same id and start for every listener.
   */
  const firePad = useCallback(
    async (track: RadioTrack) => {
      const at = Math.round(serverClock.now());
      const length = Math.round(track.duration * 1000);
      const layer: RadioLayer = {
        id: layerId(),
        lane: "pad",
        track_id: track.id,
        title: track.title,
        kind: track.kind,
        src: track.src,
        start: at,
        end: at + length,
        volume: 100,
        duck: track.duck,
        source: "live",
        fade_in: 0,
        fade_out: 0,
        loop: false,
        length,
      };
      firing.current = [...firing.current, layer];
      setState((value) => ({ ...value, layers: [...value.layers, layer] }));
      player.current?.pushLayer(layer);
      caster.current?.broadcast({ t: "layer", layer });
      let confirmed = false;
      try {
        confirmed = Boolean((await layerAction({ action: "play", id: track.id, lane: "pad", layer: layer.id, at: String(at) }))?.layer);
      } catch {
        setNotice({ tone: "error", text: "No se pudo enviar el efecto a los oyentes. Revisa tu conexión e inténtalo de nuevo." });
      }
      firing.current = firing.current.filter((item) => item.id !== layer.id);
      if (confirmed) return;
      player.current?.dropLayers([layer.id]);
      caster.current?.broadcast({ t: "stop", ids: [layer.id] });
      setState((value) => ({ ...value, layers: value.layers.filter((item) => item.id !== layer.id) }));
    },
    [layerAction, serverClock],
  );

  /** The botonera keeps its sounds decoded in the monitor, ready to fire without loading. */
  const warmPads = useCallback((tracks: RadioTrack[]) => {
    padSounds.current = tracks;
    player.current?.warm(tracks);
  }, []);

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
    player.current ??= new ProgramPlayer(serverClock, "interactive");
    player.current.warm(padSounds.current);
    await player.current.start();
    player.current.setVolume(monitorLevel);
    player.current.setReserve(state.fallback ?? []);
    player.current.setQueue(state.queue);
    player.current.setMix(state.mix);
    player.current.setLayers(state.layers);
    player.current.setVoice(caster.current?.speaking ?? false);
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

  async function beginCapture(session: string | null | undefined) {
    if (!session || config.live_source !== "consola" || captureEngine.current) return;
    const engine = new LiveCapture(caster.current!);
    captureEngine.current = engine;
    const opened = await engine.start(session);
    if (opened.recording?.status === "recording") {
      setCapturing(true);
      return;
    }
    captureEngine.current = null;
    if (opened.recording?.status === "ready") setCapture(opened.recording);
    if (opened.error) setNotice({ tone: "error", text: opened.error });
  }

  async function endCapture() {
    const engine = captureEngine.current;
    if (!engine || engine.done) return;
    setCapturing(false);
    const recording = await engine.finish(engine.id ? (serverClock.now() - (live.started_at ?? serverClock.now())) / 1000 : 0);
    captureEngine.current = null;
    if (recording?.status === "ready") setCapture(recording);
    else if (recording?.status === "discarded") setNotice({ tone: "info", text: "La transmisión fue muy corta y no se guardó el audio." });
  }

  const endCaptureRef = useRef(endCapture);
  endCaptureRef.current = endCapture;
  const sessionSeen = useRef(live.session);
  useEffect(() => {
    const previous = sessionSeen.current;
    sessionSeen.current = live.session;
    if (previous && !live.session) void endCaptureRef.current();
  }, [live.session]);

  async function startLive() {
    setBusy(true);
    setNotice(null);
    if (await openMic()) {
      const data = await liveAction({ action: "start", title: episodeTitle });
      if (data && mic.talkOnStart) {
        await talk(true);
        setNotice({ tone: "info", text: mic.voiceDuck ? "¡Estás al aire! Habla cuando quieras: la música baja sola mientras se oye tu voz." : "¡Estás al aire con tu voz! Usa «Hablar» para cerrar o abrir el micrófono." });
      } else if (data) {
        setNotice({ tone: "info", text: "¡Estás en vivo! Presiona «Hablar» cuando quieras salir al aire con tu voz." });
      }
      if (data?.live?.session && config.live_source === "externo") {
        setNotice({ tone: "info", text: "Estás al aire. La señal de la radio es externa, así que esta consola no graba ese audio." });
      } else if (data?.live?.session) {
        await beginCapture(data.live.session);
      }
    }
    setBusy(false);
  }

  async function stopLive() {
    if (!window.confirm("¿Terminar la transmisión en vivo? La grabación se detiene y podrás guardarla.")) return;
    setBusy(true);
    caster.current?.setTalking(false);
    setTalking(false);
    await endCapture();
    await liveAction({ action: "stop" }, false);
    const at = serverClock.now();
    setTalks((list) => list.map((span) => (span.end === null ? { ...span, end: at } : span)));
    caster.current?.dropAll();
    caster.current?.closeMic();
    setMicOpen(false);
    setBusy(false);
  }

  /**
   * Opens or closes the microphone on air. With «Detectar voz» the program drops only while the
   * voice is heard; without it, «Auto fondo» keeps the music at bed level the whole time.
   */
  async function talk(next: boolean) {
    caster.current?.setTalking(next);
    setTalking(next);
    const at = serverClock.now();
    setTalks((list) => (next ? [...list.slice(-30), { start: at, end: null }] : list.map((span) => (span.end === null ? { ...span, end: at } : span))));
    const bed = next ? mic.autoBed && !mic.voiceDuck : mic.autoBed;
    await liveAction(bed ? { action: "mix", mic: next ? "1" : "0", bed: next ? "1" : "0" } : { action: "mix", mic: next ? "1" : "0" });
  }

  async function toggleTalk() {
    await talk(!talking);
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

  /** Stops or resumes the automatic music that fills the gaps of the program. */
  async function toggleAutofill() {
    const on = !config.autofill;
    if (!on && !window.confirm("¿Detener el modo automático? Lo que no esté programado quedará en silencio hasta que lo inicies de nuevo.")) return;
    await musicAction({ action: "autofill", on: on ? "1" : "0" });
  }

  /** «Repetir»: the automatic music starts over at its end, or plays to its last song and then falls silent. */
  async function setRepeat(on: boolean) {
    await musicAction({ action: "repeat", on: on ? "1" : "0" });
  }

  /** Takes the song on air out of the continuous music: it fades out now and does not repeat. */
  async function dropFromRotation(trackId: string, title: string) {
    if (!window.confirm(`¿Sacar «${title}» de la música automática?\n\nDeja de sonar ahora, sale de sus listas y no se repetirá. Puedes volver a incluirla cuando quieras desde Listas o la Biblioteca.`)) return;
    await musicAction({ action: "drop", id: trackId });
  }

  /** Changes what the automatic music plays, when the song on air ends or at the song boundary the operator picked. */
  async function switchSource(playlist: string, shuffle: boolean, timing: SwitchTiming) {
    await musicAction({ action: "source", playlist, shuffle: shuffle ? "1" : "0", when: timing.when, ...(timing.when === "at" ? { at: String(timing.at) } : {}) });
  }

  /** «Iniciar modo automático»: the source starts for every listener within seconds, from the chosen song ("" = from the top). */
  async function startAutopilot(playlist: string, shuffle: boolean, first: string, repeat: boolean) {
    await musicAction({ action: "start", playlist, shuffle: shuffle ? "1" : "0", first, repeat: repeat ? "1" : "0" });
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
  async function resumeMusic(source?: { playlist: string; shuffle: boolean }) {
    await musicAction({
      action: "cut",
      on: "0",
      ...(source ? { playlist: source.playlist, shuffle: source.shuffle ? "1" : "0" } : {}),
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
    startAutopilot,
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
    speaking,
    episodeTitle,
    setEpisodeTitle,
    busy,
    player,
    caster,
    liveAction,
    layerAction,
    play,
    drop,
    firePad,
    warmPads,
    stop,
    blend,
    setBlend,
    talks,
    toggleMonitor,
    changeMonitorLevel,
    openMic,
    startLive,
    stopLive,
    capturing,
    capture,
    clearCapture: () => setCapture(null),
    toggleTalk,
    toggleAir,
    toggleAutofill,
    setRepeat,
    dropFromRotation,
  };
}

export type ConsoleApi = ReturnType<typeof useConsole>;
