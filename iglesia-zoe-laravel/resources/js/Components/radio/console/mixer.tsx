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

/** Channel strips: microphone, program music, layers (beds, effects, players and overlays) and the local monitor. */
export function Mixer({ api }: { api: ConsoleApi }) {
  const { live, config, mic, micOpen, talking, monitor, monitorLevel, caster, player, liveAction } = api;
  const session = live.session;
  const program = monitor ? player.current?.analyser ?? null : null;
  const [music, setMusic] = useSentLevel(live.music, (value) => liveAction({ action: "mix", music: String(value) }));
  const [overlay, setOverlay] = useSentLevel(live.overlay, (value) => liveAction({ action: "mix", overlay: String(value) }));

  return (
    <div className="cx-panel">
      <div className="cx-head">
        <p className="studio-label">Mezclador</p>
      </div>
      <div className="mixer mt-2">
        <div className="studio-strip">
          <p className="strip-name">Mic</p>
          <Fader value={mic.level} max={1.6} step={0.01} disabled={!micOpen} label="Volumen del micrófono" analyser={micOpen ? caster.current?.analyser ?? null : null} onChange={(level) => api.changeMic({ level })} />
          <p className="strip-value">{Math.round(mic.level * 100)}%</p>
          <button type="button" disabled={!session || !micOpen} onClick={api.toggleTalk} className="studio-talk" data-on={talking || undefined} title="Hablar al aire">
            <span className="flex items-center gap-1"><MicIcon className="h-3.5 w-3.5" /> {talking ? "Al aire" : "Hablar"}</span>
          </button>
          <button type="button" onClick={() => api.changeMic({ autoBed: !mic.autoBed })} className="studio-btn" data-on={mic.autoBed ? "amber" : undefined} title="Bajar la música a fondo mientras hablas">Auto fondo</button>
          <button type="button" disabled={!micOpen} onClick={() => api.changeMic({ selfMonitor: !mic.selfMonitor })} className="studio-btn" data-on={mic.selfMonitor ? "blue" : undefined} title="Escucharte en los audífonos">Retorno</button>
        </div>

        <div className="studio-strip">
          <p className="strip-name">Música</p>
          <Fader value={music} label="Volumen de la música" analyser={program} onChange={setMusic} />
          <p className="strip-value">{live.muted ? "parada" : live.bed ? `fondo ${config.bed_level}%` : `${music}%`}</p>
          <button type="button" onClick={() => liveAction({ action: "mix", bed: live.bed ? "0" : "1" })} className="studio-btn" data-on={live.bed ? "amber" : undefined} title="Música del programa a nivel de fondo">Fondo</button>
          <button type="button" onClick={() => liveAction({ action: "mix", muted: live.muted ? "0" : "1" })} className="studio-btn" data-on={live.muted ? "red" : undefined}>
            {live.muted ? "Reanudar" : "Parar"}
          </button>
        </div>

        <div className="studio-strip">
          <p className="strip-name">Capas</p>
          <Fader value={overlay} label="Volumen de fondos, efectos, reproductores y capas" analyser={program} onChange={setOverlay} />
          <p className="strip-value">{overlay}%</p>
          <p className="text-center text-[9.5px] leading-3 text-white/35">Fondos, botonera y reproductores · tope {config.fx_level}%</p>
        </div>

        <div className="studio-strip">
          <p className="strip-name">Monitor</p>
          <Fader value={monitorLevel} max={1} step={0.01} label="Volumen del monitor" analyser={program} onChange={api.changeMonitorLevel} />
          <p className="strip-value">{Math.round(monitorLevel * 100)}%</p>
          <button type="button" onClick={api.toggleMonitor} className="studio-btn" data-on={monitor ? "green" : undefined}>
            <HeadphonesIcon className="h-3.5 w-3.5" /> {monitor ? "On" : "Oír"}
          </button>
        </div>
      </div>
    </div>
  );
}
