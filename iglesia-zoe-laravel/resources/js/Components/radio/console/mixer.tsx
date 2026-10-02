import { useEffect, useRef, useState } from "react";
import { HeadphonesIcon, MicIcon } from "@/Components/radio/icons";
import { Meter } from "@/Components/radio/meters";
import type { ConsoleApi } from "./use-console";

/** A fader that answers at once on screen and sends its value to the server shortly after the hand stops. */
function useSentLevel(value: number, send: (value: number) => Promise<unknown>) {
  const [local, setLocal] = useState(value);
  const dragging = useRef(false);
  const timer = useRef(0);

  useEffect(() => {
    if (!dragging.current) setLocal(value);
  }, [value]);

  function change(next: number) {
    setLocal(next);
    dragging.current = true;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(async () => {
      await send(next);
      dragging.current = false;
    }, 120);
  }

  return [local, change] as const;
}

function Fader({ value, min = 0, max = 100, step = 1, disabled, label, analyser, onChange }: { value: number; min?: number; max?: number; step?: number; disabled?: boolean; label: string; analyser: AnalyserNode | null; onChange: (value: number) => void }) {
  return (
    <div className="studio-fader-wrap">
      <input type="range" min={min} max={max} step={step} value={value} disabled={disabled} onChange={(event) => onChange(Number(event.target.value))} className="studio-fader" aria-label={label} />
      <Meter analyser={analyser} />
    </div>
  );
}

/** Channel strips: microphone, program music, layers (effects, players and overlays) and the local monitor. */
export function Mixer({ api }: { api: ConsoleApi }) {
  const { live, config, mic, micOpen, talking, monitor, monitorLevel, caster, player, liveAction } = api;
  const session = live.session;
  const program = monitor ? player.current?.analyser ?? null : null;
  const [music, setMusic] = useSentLevel(live.music, (value) => liveAction({ action: "mix", music: String(value) }));
  const [overlay, setOverlay] = useSentLevel(live.overlay, (value) => liveAction({ action: "mix", overlay: String(value) }));

  return (
    <div className="mixer">
      <div className="studio-strip">
        <p className="studio-label">Micrófono</p>
        <Fader value={mic.level} max={1.6} step={0.01} disabled={!micOpen} label="Volumen del micrófono" analyser={micOpen ? caster.current?.analyser ?? null : null} onChange={(level) => api.changeMic({ level })} />
        <p className="strip-value">{Math.round(mic.level * 100)}%</p>
        <button type="button" disabled={!session || !micOpen} onClick={api.toggleTalk} className="studio-talk" data-on={talking || undefined}>
          <span className="flex items-center gap-2"><MicIcon /> {talking ? "Al aire" : "Hablar"}</span>
        </button>
        <label className="strip-check">
          <input type="checkbox" checked={mic.autoBed} onChange={(event) => api.changeMic({ autoBed: event.target.checked })} /> Música de fondo al hablar
        </label>
        <label className="strip-check">
          <input type="checkbox" checked={mic.selfMonitor} disabled={!micOpen} onChange={(event) => api.changeMic({ selfMonitor: event.target.checked })} /> Escucharme (audífonos)
        </label>
      </div>

      <div className="studio-strip">
        <p className="studio-label">Música</p>
        <Fader value={music} label="Volumen de la música" analyser={program} onChange={setMusic} />
        <p className="strip-value">{live.muted ? "detenida" : live.bed ? `fondo ${config.bed_level}%` : `${music}%`}</p>
        <button type="button" onClick={() => liveAction({ action: "mix", bed: live.bed ? "0" : "1" })} className="studio-btn" data-on={live.bed ? "amber" : undefined}>
          De fondo
        </button>
        <button type="button" onClick={() => liveAction({ action: "mix", muted: live.muted ? "0" : "1" })} className="studio-btn" data-on={live.muted ? "red" : undefined}>
          {live.muted ? "Reanudar" : "Parar música"}
        </button>
      </div>

      <div className="studio-strip">
        <p className="studio-label">Efectos y capas</p>
        <Fader value={overlay} label="Volumen de efectos, reproductores y capas" analyser={program} onChange={setOverlay} />
        <p className="strip-value">{overlay}%</p>
        <p className="text-center text-[11px] leading-4 text-white/40">Botonera, reproductores y capas programadas. Tope general: {config.fx_level}%.</p>
      </div>

      <div className="studio-strip">
        <p className="studio-label">Monitor</p>
        <Fader value={monitorLevel} max={1} step={0.01} label="Volumen del monitor" analyser={program} onChange={api.changeMonitorLevel} />
        <p className="strip-value">{Math.round(monitorLevel * 100)}%</p>
        <button type="button" onClick={api.toggleMonitor} className="studio-btn" data-on={monitor ? "green" : undefined}>
          <HeadphonesIcon className="h-4 w-4" /> {monitor ? "Escuchando" : "Escuchar"}
        </button>
        <p className="text-center text-[11px] leading-4 text-white/40">Oyes lo mismo que los oyentes, sin tu voz.</p>
      </div>
    </div>
  );
}
