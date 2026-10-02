import { Link } from "@inertiajs/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { KindTag, RadioHeader } from "@/Components/radio/admin-ui";
import { HeadphonesIcon, MicIcon, UsersIcon } from "@/Components/radio/icons";
import { Meter } from "@/Components/radio/meters";
import AdminLayout from "@/Layouts/AdminLayout";
import { send } from "@/lib/actions";
import {
  Broadcaster,
  KIND_LABEL,
  ProgramPlayer,
  ServerClock,
  clock,
  currentItem,
  duration,
  postForm,
  type RadioBlock,
  type RadioConfig,
  type RadioFx,
  type RadioState,
  type RadioTrack,
} from "@/lib/radio";
import "../../../../css/radio.css";

type Live = { session: string | null; host: string; started_at: number | null; music: number; muted: boolean; bed: boolean; mic: boolean; fx: RadioFx[]; rev: number };

type Snapshot = { radio: RadioState; live: Live; voice: number; config: RadioConfig };

type Props = {
  config: RadioConfig;
  radio: RadioState;
  live: Live;
  pads: RadioTrack[];
  library: RadioTrack[];
  today: string;
  day: RadioBlock[];
  host: string;
};

export default function Consola({ config, radio, live: initialLive, pads, library, today, day, host }: Props) {
  const clockRef = useRef<ServerClock | null>(null);
  clockRef.current ??= new ServerClock();
  const serverClock = clockRef.current;
  const player = useRef<ProgramPlayer | null>(null);
  const caster = useRef<Broadcaster | null>(null);
  caster.current ??= new Broadcaster();

  const [state, setState] = useState(radio);
  const [live, setLive] = useState(initialLive);
  const [cfg, setCfg] = useState(config);
  const [voice, setVoice] = useState(0);
  const [now, setNow] = useState(radio.now);
  const [hostName, setHostName] = useState(initialLive.host || host);
  const [micOpen, setMicOpen] = useState(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState<string>("");
  const [processing, setProcessing] = useState(true);
  const [micLevel, setMicLevel] = useState(1);
  const [talking, setTalking] = useState(false);
  const [autoBed, setAutoBed] = useState(true);
  const [returnOn, setReturnOn] = useState(false);
  const [monitor, setMonitor] = useState(false);
  const [monitorLevel, setMonitorLevel] = useState(0.8);
  const [music, setMusic] = useState(initialLive.music);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "error" | "info"; text: string } | null>(null);
  const [fired, setFired] = useState<string | null>(null);
  const [launch, setLaunch] = useState("");
  const [, force] = useState(0);
  const musicTimer = useRef(0);
  const musicDragging = useRef(false);

  const session = live.session;
  const item = currentItem(state.queue, now);
  const upcoming = state.queue.filter((entry) => entry.start > now).slice(0, 4);

  const apply = useCallback(
    (data: Snapshot, broadcast = false) => {
      setState(data.radio);
      setLive(data.live);
      setCfg(data.config);
      setVoice(data.voice);
      if (!musicDragging.current) setMusic(data.live.music);
      player.current?.setQueue(data.radio.queue);
      player.current?.setMix(data.radio.mix);
      if (broadcast) caster.current?.broadcast({ t: "mix", mix: data.radio.mix, rev: data.live.rev });
    },
    [],
  );

  useEffect(() => {
    if (session && live.host) setHostName(live.host);
  }, [session]);

  useEffect(() => {
    serverClock.seed(radio.now);
    const timer = window.setInterval(() => setNow(serverClock.now()), 250);
    return () => window.clearInterval(timer);
  }, [radio.now, serverClock]);

  useEffect(() => {
    let stop = false;
    let timer = 0;
    const loop = async () => {
      const sent = Date.now();
      try {
        const res = await fetch("/admin/radio/senal", { headers: { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" }, cache: "no-store" });
        if (res.ok) {
          const data = (await res.json()) as Snapshot & { pending: string[]; answers: { id: string; answer: string }[]; alive: string[] };
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

  async function liveAction(payload: Record<string, string>, broadcast = true) {
    const data = (await postForm("/admin/radio/vivo", payload)) as Snapshot & { ok?: boolean; error?: string };
    if (data.error) {
      setMessage({ tone: "error", text: data.error });
      return null;
    }
    if (data.ok) apply(data, broadcast);
    return data;
  }

  async function openMic() {
    try {
      await caster.current!.openMic(deviceId || null, processing);
      caster.current!.setLevel(micLevel);
      caster.current!.setTalking(talking);
      caster.current!.setReturn(returnOn);
      setMicOpen(true);
      const list = await navigator.mediaDevices.enumerateDevices();
      setDevices(list.filter((device) => device.kind === "audioinput"));
      return true;
    } catch {
      setMessage({ tone: "error", text: "No pudimos usar el micrófono. Permite el acceso al micrófono en el navegador (ícono del candado junto a la dirección) e inténtalo otra vez." });
      return false;
    }
  }

  async function startLive() {
    setBusy(true);
    setMessage(null);
    if (await openMic()) {
      const data = await liveAction({ action: "start", host: hostName });
      if (data) setMessage({ tone: "info", text: "¡Estás en vivo! Presiona «Hablar» cuando quieras salir al aire con tu voz." });
    }
    setBusy(false);
  }

  async function stopLive() {
    if (!window.confirm("¿Terminar la transmisión en vivo? La música programada sigue sonando.")) return;
    setBusy(true);
    caster.current?.setTalking(false);
    setTalking(false);
    await liveAction({ action: "stop" }, false);
    caster.current?.dropAll();
    caster.current?.closeMic();
    setMicOpen(false);
    setBusy(false);
    setMessage(null);
  }

  async function toggleTalk() {
    const next = !talking;
    caster.current?.setTalking(next);
    setTalking(next);
    await liveAction(autoBed ? { action: "mix", mic: next ? "1" : "0", bed: next ? "1" : "0" } : { action: "mix", mic: next ? "1" : "0" });
  }

  function changeMusic(value: number) {
    setMusic(value);
    musicDragging.current = true;
    window.clearTimeout(musicTimer.current);
    musicTimer.current = window.setTimeout(async () => {
      await liveAction({ action: "mix", music: String(value) });
      musicDragging.current = false;
    }, 120);
  }

  async function fire(track: RadioTrack) {
    setFired(track.id);
    window.setTimeout(() => setFired((value) => (value === track.id ? null : value)), 650);
    const data = await postForm("/admin/radio/efecto", { id: track.id });
    if (data?.fx) {
      player.current?.fx(data.fx as RadioFx, true);
      caster.current?.broadcast({ t: "fx", fx: data.fx as RadioFx });
    } else if (data?.error) {
      setMessage({ tone: "error", text: data.error });
    }
  }

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
    setMonitor(true);
  }

  async function toggleAir() {
    const on = !cfg.on_air;
    if (!on && !window.confirm("¿Sacar la radio del aire? Los oyentes dejarán de escuchar la programación.")) return;
    await liveAction({ action: "air", on: on ? "1" : "0" }, false);
  }

  async function launchNow() {
    if (!launch) return;
    const result = await send("/admin/radio/programacion", { date: today, mode: "now", tracks: [launch] });
    setMessage(result.error ? { tone: "error", text: result.error } : { tone: "info", text: result.message ?? "Al aire." });
    setLaunch("");
  }

  const elapsed = live.started_at ? duration((now - live.started_at) / 1000) : "0:00";
  const mic = caster.current;

  return (
    <AdminLayout>
      <RadioHeader
        title="Consola en vivo"
        text="Desde aquí sales al aire con tu voz, mezclas la música, la pones de fondo o la detienes y lanzas efectos y anuncios. La programación sigue sola, a la hora exacta, aunque nadie esté en la consola."
      />

      {message ? (
        <div className={`mt-6 flex items-start justify-between gap-4 rounded-2xl px-4 py-3 text-sm ${message.tone === "error" ? "bg-red-50 text-red-800" : "bg-emerald-50 text-emerald-800"}`}>
          <p>{message.text}</p>
          <button type="button" onClick={() => setMessage(null)} className="opacity-60">×</button>
        </div>
      ) : null}

      <div className="studio mt-6">
        <div className="flex flex-wrap items-center gap-3">
          <span className="studio-onair" data-on={session ? "" : undefined}>
            <span className="h-2 w-2 rounded-full bg-current" /> {session ? "En vivo" : "Sin locutor"}
          </span>
          {session ? <span className="font-mono text-lg tabular-nums text-white/90">{elapsed}</span> : null}
          <span className="inline-flex items-center gap-2 rounded-lg bg-white/5 px-3 py-1.5 text-sm text-white/70">
            <UsersIcon /> {state.listeners} oyentes
          </span>
          {session ? (
            <span className="inline-flex items-center gap-2 rounded-lg bg-white/5 px-3 py-1.5 text-sm text-white/70">
              <MicIcon className="h-4 w-4" /> Voz conectada con {voice}
              {mic?.connected !== voice ? <span className="text-white/40">({mic?.connected ?? 0} aquí)</span> : null}
            </span>
          ) : null}
          <button
            type="button"
            onClick={toggleAir}
            className={`ml-auto inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-semibold transition ${cfg.on_air ? "bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600/30" : "bg-white/10 text-white/60 hover:bg-white/15"}`}
          >
            <span className={`h-2 w-2 rounded-full ${cfg.on_air ? "bg-emerald-400" : "bg-white/40"}`} />
            {cfg.on_air ? "Radio al aire" : "Radio fuera del aire"}
          </button>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-[1.35fr_1fr]">
          <div className="studio-panel">
            <div className="flex items-center justify-between gap-3">
              <p className="studio-label">Sonando ahora</p>
              {item ? <KindTag kind={item.bed ? "vivo" : item.kind} label={item.bed ? "Fondo de bloque en vivo" : undefined} /> : null}
            </div>
            {item ? (
              <>
                {item.block ? <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-red-300">{item.block}</p> : null}
                <p className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-white">{item.title}</p>
                <p className="mt-1 text-sm text-white/55">{item.artist || KIND_LABEL[item.kind]}</p>
                <div className="studio-progress mt-4">
                  <span style={{ width: `${Math.min(100, Math.max(0, ((now - item.origin) / Math.max(1, item.end - item.origin)) * 100))}%` }} />
                </div>
                <div className="mt-2 flex justify-between font-mono text-xs tabular-nums text-white/50">
                  <span>{duration((now - item.origin) / 1000)}</span>
                  <span>termina {clock(item.end, true)} · -{duration((item.end - now) / 1000)}</span>
                </div>
              </>
            ) : (
              <p className="mt-3 text-lg text-white/60">{cfg.on_air ? "Silencio: no hay nada programado y la música continua está apagada o sin canciones." : "La radio está fuera del aire."}</p>
            )}
            <p className="studio-label mt-6">A continuación</p>
            <ul className="mt-2 divide-y divide-white/5">
              {upcoming.length ? (
                upcoming.map((entry) => (
                  <li key={entry.id} className="flex items-center gap-3 py-2 text-sm">
                    <span className="w-16 shrink-0 font-mono tabular-nums text-white/50">{clock(entry.start, true)}</span>
                    <span className="min-w-0 flex-1 truncate text-white/85">
                      {entry.title}
                      {entry.artist ? <span className="text-white/40"> · {entry.artist}</span> : null}
                    </span>
                    <span className="shrink-0 text-xs text-white/40">{entry.bed ? "fondo" : KIND_LABEL[entry.kind]}</span>
                  </li>
                ))
              ) : (
                <li className="py-2 text-sm text-white/40">Nada más en las próximas horas.</li>
              )}
            </ul>
          </div>

          <div className="studio-panel">
            <p className="studio-label">Transmisión en vivo</p>
            {session ? (
              <div className="mt-3 space-y-4">
                <p className="text-sm leading-6 text-white/70">
                  Al aire desde las {live.started_at ? clock(live.started_at) : "--"} como <strong className="text-white">{live.host}</strong>. Mantén esta pestaña abierta mientras dure la transmisión.
                </p>
                {!micOpen ? (
                  <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-100">
                    Esta pestaña no tiene el micrófono conectado (¿recargaste la página?).
                    <button type="button" onClick={openMic} className="studio-btn mt-3" data-on="amber">Conectar micrófono</button>
                  </div>
                ) : null}
                <label className="block text-xs font-semibold text-white/50">
                  Nombre al aire
                  <div className="mt-1.5 flex gap-2">
                    <input value={hostName} onChange={(event) => setHostName(event.target.value)} maxLength={80} className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-white/30" />
                    <button type="button" onClick={() => liveAction({ action: "mix", host: hostName })} className="studio-btn !w-auto">Guardar</button>
                  </div>
                </label>
                <button type="button" disabled={busy} onClick={stopLive} className="studio-btn" data-on="red">Terminar transmisión</button>
              </div>
            ) : (
              <div className="mt-3 space-y-3">
                <p className="text-sm leading-6 text-white/65">Abre la transmisión para hablar en vivo. Tu voz llega a cada oyente al instante, encima de la música.</p>
                <label className="block text-xs font-semibold text-white/50">
                  Nombre al aire
                  <input value={hostName} onChange={(event) => setHostName(event.target.value)} maxLength={80} className="mt-1.5 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-white/30" />
                </label>
                {devices.length > 1 ? (
                  <label className="block text-xs font-semibold text-white/50">
                    Micrófono
                    <select value={deviceId} onChange={(event) => setDeviceId(event.target.value)} className="mt-1.5 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white">
                      <option value="">Predeterminado del sistema</option>
                      {devices.map((device) => (
                        <option key={device.deviceId} value={device.deviceId}>{device.label || "Micrófono"}</option>
                      ))}
                    </select>
                  </label>
                ) : null}
                <label className="flex items-start gap-2 text-sm text-white/70">
                  <input type="checkbox" checked={processing} onChange={(event) => setProcessing(event.target.checked)} className="mt-1" />
                  <span>Reducir eco y ruido <span className="block text-xs text-white/40">Desactívalo si usas una consola o micrófono profesional.</span></span>
                </label>
                <button type="button" disabled={busy} onClick={startLive} className="studio-talk !min-h-[3.4rem] !text-sm" data-on="">
                  {busy ? "Conectando…" : "Abrir transmisión en vivo"}
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-[auto_1fr]">
          <div className="grid grid-cols-3 gap-3 sm:min-w-[30rem]">
            <div className="studio-strip">
              <p className="studio-label">Micrófono</p>
              <div className="studio-fader-wrap">
                <input
                  type="range"
                  min={0}
                  max={1.6}
                  step={0.01}
                  value={micLevel}
                  disabled={!micOpen}
                  onChange={(event) => {
                    const value = Number(event.target.value);
                    setMicLevel(value);
                    mic?.setLevel(value);
                  }}
                  className="studio-fader"
                  aria-label="Volumen del micrófono"
                />
                <Meter analyser={micOpen ? mic?.analyser ?? null : null} />
              </div>
              <p className="font-mono text-xs tabular-nums text-white/50">{Math.round(micLevel * 100)}%</p>
              <button type="button" disabled={!session || !micOpen} onClick={toggleTalk} className="studio-talk" data-on={talking || undefined}>
                <span className="flex items-center gap-2"><MicIcon /> {talking ? "Al aire" : "Hablar"}</span>
              </button>
              <label className="flex w-full items-center gap-2 text-[11px] text-white/55">
                <input type="checkbox" checked={autoBed} onChange={(event) => setAutoBed(event.target.checked)} /> Música de fondo al hablar
              </label>
              <label className="flex w-full items-center gap-2 text-[11px] text-white/55">
                <input
                  type="checkbox"
                  checked={returnOn}
                  disabled={!micOpen}
                  onChange={(event) => {
                    setReturnOn(event.target.checked);
                    mic?.setReturn(event.target.checked);
                  }}
                />
                Escucharme (solo audífonos)
              </label>
            </div>

            <div className="studio-strip">
              <p className="studio-label">Música</p>
              <div className="studio-fader-wrap">
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={music}
                  disabled={!session}
                  onChange={(event) => changeMusic(Number(event.target.value))}
                  className="studio-fader"
                  aria-label="Volumen de la música"
                />
                <Meter analyser={monitor ? player.current?.analyser ?? null : null} />
              </div>
              <p className="font-mono text-xs tabular-nums text-white/50">{live.muted ? "detenida" : live.bed ? `fondo ${cfg.bed_level}%` : `${music}%`}</p>
              <button type="button" disabled={!session} onClick={() => liveAction({ action: "mix", bed: live.bed ? "0" : "1" })} className="studio-btn" data-on={live.bed ? "amber" : undefined}>
                Fondo
              </button>
              <button type="button" disabled={!session} onClick={() => liveAction({ action: "mix", muted: live.muted ? "0" : "1" })} className="studio-btn" data-on={live.muted ? "red" : undefined}>
                {live.muted ? "Reanudar" : "Parar música"}
              </button>
            </div>

            <div className="studio-strip">
              <p className="studio-label">Monitor</p>
              <div className="studio-fader-wrap">
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={monitorLevel}
                  onChange={(event) => {
                    const value = Number(event.target.value);
                    setMonitorLevel(value);
                    player.current?.setVolume(value);
                  }}
                  className="studio-fader"
                  aria-label="Volumen del monitor"
                />
                <Meter analyser={monitor ? player.current?.analyser ?? null : null} />
              </div>
              <p className="font-mono text-xs tabular-nums text-white/50">{Math.round(monitorLevel * 100)}%</p>
              <button type="button" onClick={toggleMonitor} className="studio-btn" data-on={monitor ? "green" : undefined}>
                <HeadphonesIcon className="h-4 w-4" /> {monitor ? "Escuchando" : "Escuchar aquí"}
              </button>
              <p className="text-center text-[11px] leading-4 text-white/40">Oyes lo mismo que los oyentes, sin tu voz.</p>
            </div>
          </div>

          <div className="studio-panel">
            <div className="flex items-center justify-between gap-3">
              <p className="studio-label">Efectos y anuncios al instante</p>
              <Link href="/admin/radio/biblioteca" className="text-xs font-semibold text-white/50 hover:text-white">Subir más →</Link>
            </div>
            {pads.length ? (
              <div className="studio-pads mt-3">
                {pads.map((pad) => (
                  <button key={pad.id} type="button" onClick={() => fire(pad)} className="studio-pad" data-kind={pad.kind} data-fired={fired === pad.id || undefined}>
                    <span className="line-clamp-2 text-sm font-semibold leading-tight">{pad.title}</span>
                    <span className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-white/60">
                      {pad.kind === "efecto" ? "Efecto" : "Anuncio"} · {duration(pad.duration)}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="mt-3 rounded-xl border border-dashed border-white/15 px-4 py-6 text-center text-sm text-white/45">
                Sube audios de tipo «Efecto» o «Anuncio» en la Biblioteca y aparecerán aquí como botones.
              </p>
            )}
            <p className="mt-3 text-[11px] leading-4 text-white/40">Suenan encima de la música para todos los oyentes. Volumen de efectos: {cfg.fx_level}% (en Ajustes).</p>

            <div className="mt-5 border-t border-white/10 pt-4">
              <p className="studio-label">Al aire ahora</p>
              <p className="mt-1 text-[11px] leading-4 text-white/40">Corta lo que suena, lo reproduce de inmediato y corre la programación siguiente lo necesario.</p>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                <select value={launch} onChange={(event) => setLaunch(event.target.value)} className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white">
                  <option value="">Elige un audio de la biblioteca…</option>
                  {library.map((track) => (
                    <option key={track.id} value={track.id}>{KIND_LABEL[track.kind]} · {track.title} ({duration(track.duration)})</option>
                  ))}
                </select>
                <button type="button" disabled={!launch} onClick={launchNow} className="studio-btn sm:!w-auto" data-on={launch ? "blue" : undefined}>Lanzar</button>
              </div>
            </div>
          </div>
        </div>

        <div className="studio-panel mt-4">
          <div className="flex items-center justify-between gap-3">
            <p className="studio-label">Programación de hoy</p>
            <Link href="/admin/radio/programacion" className="text-xs font-semibold text-white/50 hover:text-white">Abrir línea de tiempo →</Link>
          </div>
          {day.length ? (
            <ul className="mt-2 max-h-72 divide-y divide-white/5 overflow-y-auto pr-1">
              {day.map((block) => {
                const isNow = block.start <= now && now < block.end;
                return (
                  <li key={block.id} className={`flex items-center gap-3 rounded-lg px-2 py-2 text-sm ${isNow ? "bg-white/10" : block.end < now ? "opacity-40" : ""}`}>
                    <span className="w-36 shrink-0 font-mono text-xs tabular-nums text-white/55">{clock(block.start, true)} – {clock(block.end, true)}</span>
                    <span className="min-w-0 flex-1 truncate text-white/85">{block.title}</span>
                    {isNow ? <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-red-300">Ahora</span> : null}
                    <KindTag kind={block.kind} />
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-white/45">
              No hay bloques para hoy. {cfg.autofill ? "Suena la música continua de la biblioteca." : "La música continua está apagada (Ajustes)."}
            </p>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
