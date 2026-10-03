import { useRef, useState } from "react";
import { DuckIcon, PlayIcon, StopIcon } from "@/Components/radio/icons";
import { BEDS, FADES, KIND_LABEL, PLAYERS, duration, shortTitle, type RadioTrack } from "@/lib/radio";
import { useTrackDrop } from "./drag";
import type { ConsoleApi } from "./use-console";

const GROUPS = ["musica", "efecto", "anuncio", "programa"] as const;

/** Background beds and players: each one sounds on top of the program and of the others. */
export function Decks({ api, library }: { api: ConsoleApi; library: RadioTrack[] }) {
  return (
    <div className="cx-panel">
      <div className="cx-head">
        <p className="studio-label">Fondos y reproductores</p>
        <p className="text-[10.5px] text-white/35">Suelta un sonido para cargarlo · ⟲ bucle · ↘ fundir</p>
      </div>
      <div className="cx-decks mt-2">
        {[...BEDS, ...PLAYERS].map((lane) => (
          <Deck key={lane} lane={lane} api={api} library={library} />
        ))}
      </div>
    </div>
  );
}

function Deck({ lane, api, library }: { lane: string; api: ConsoleApi; library: RadioTrack[] }) {
  const { state, now, layerAction } = api;
  const bed = (BEDS as readonly string[]).includes(lane);
  const [trackId, setTrackId] = useState("");
  const [volume, setVolume] = useState(bed ? 70 : 100);
  const [duck, setDuck] = useState(!bed);
  const [fadeIn, setFadeIn] = useState(bed ? 3 : 0);
  const [fadeOut, setFadeOut] = useState(bed ? 3 : 0);
  const [loop, setLoop] = useState(bed);
  const timer = useRef(0);
  const playing =
    state.layers
      .filter((layer) => layer.lane === lane && layer.source === "live" && !layer.fading && layer.start <= now && now < layer.end)
      .sort((a, b) => b.start - a.start)[0] ?? null;
  const fading = state.layers.some((layer) => layer.lane === lane && layer.source === "live" && layer.fading && now < layer.end);
  const track = library.find((item) => item.id === trackId) ?? null;
  const drop = useTrackDrop(library, (next) => choose(next.id));

  function choose(id: string) {
    setTrackId(id);
    const next = library.find((item) => item.id === id);
    if (next && !bed) setDuck(next.duck);
  }

  function adjust(nextVolume: number, nextDuck: boolean) {
    setVolume(nextVolume);
    setDuck(nextDuck);
    if (!playing) return;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      void layerAction({ action: "update", layer: playing.id, volume: String(nextVolume), duck: nextDuck ? "1" : "0" });
    }, 150);
  }

  function start() {
    if (!track) return;
    void api.play(track, lane, { volume, duck, fadeIn: fadeIn || (playing ? api.blend : 0), fadeOut, loop });
  }

  const progress = playing ? (playing.loop ? (((now - playing.start) % Math.max(1, playing.length ?? 1)) / Math.max(1, playing.length ?? 1)) * 100 : ((now - playing.start) / Math.max(1, playing.end - playing.start)) * 100) : 0;

  return (
    <div className="cx-deck" data-bed={bed || undefined} data-playing={playing ? "" : undefined} {...drop}>
      <div className="flex items-center gap-1.5">
        <span className="cx-deck-id">{lane}</span>
        <select value={trackId} onChange={(event) => choose(event.target.value)} className="cx-select min-w-0 flex-1" aria-label={`Audio de ${lane}`}>
          <option value="">{bed ? "Fondo: elige o suelta…" : "Elige o suelta…"}</option>
          {GROUPS.map((kind) => {
            const items = library.filter((item) => item.kind === kind);
            return items.length ? (
              <optgroup key={kind} label={KIND_LABEL[kind]}>
                {items.map((item) => (
                  <option key={item.id} value={item.id}>{item.title} ({duration(item.duration)})</option>
                ))}
              </optgroup>
            ) : null;
          })}
        </select>
        <button type="button" disabled={!track} onClick={start} className="cx-round" data-tone="green" aria-label={playing ? `Cambiar ${lane} con empalme` : `Reproducir ${lane}`} title={playing ? "Cambiar con empalme" : "Reproducir"}>
          <PlayIcon className="h-3 w-3" />
        </button>
        <button type="button" disabled={!playing} onClick={() => playing && api.stop({ layer: playing.id }, fadeOut || api.blend || 2)} className="cx-round" data-tone="amber" aria-label={`Fundir ${lane}`} title="Fundir y detener">↘</button>
        <button type="button" disabled={!playing && !fading} onClick={() => api.stop({ lane })} className="cx-round" data-tone="red" aria-label={`Cortar ${lane}`} title="Cortar">
          <StopIcon className="h-2.5 w-2.5" />
        </button>
      </div>

      <div className="cx-deck-bar mt-1.5">
        <span style={{ width: `${Math.min(100, progress)}%` }} />
        <em>
          {playing ? (
            <>
              {playing.loop ? "⟲ " : ""}
              {shortTitle(playing.title, 34)} · {playing.loop ? duration((now - playing.start) / 1000) : `-${duration((playing.end - now) / 1000)}`}
            </>
          ) : fading ? (
            "Fundiendo…"
          ) : track ? (
            `${KIND_LABEL[track.kind]} · ${duration(track.duration)}`
          ) : (
            "Libre"
          )}
        </em>
      </div>

      <div className="mt-1.5 flex items-center gap-1.5">
        <input type="range" min={0} max={100} value={volume} onChange={(event) => adjust(Number(event.target.value), duck)} className="cx-range min-w-0 flex-1" aria-label={`Volumen de ${lane}`} />
        <span className="w-7 text-right font-mono text-[10px] tabular-nums text-white/50">{volume}</span>
        <FadeSelect label="In" value={fadeIn} onChange={setFadeIn} />
        <FadeSelect label="Out" value={fadeOut} onChange={setFadeOut} />
        <button type="button" onClick={() => setLoop(!loop)} className="cx-toggle" data-on={loop || undefined} aria-pressed={loop} title="Repetir en bucle hasta detenerlo">⟲</button>
        <button type="button" onClick={() => adjust(volume, !duck)} className="cx-toggle" data-on={duck || undefined} aria-pressed={duck} title="Bajar la música mientras suena">
          <DuckIcon className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

function FadeSelect({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="cx-fade-pick" title={`Fundido de ${label === "In" ? "entrada" : "salida"}`}>
      {label}
      <select value={value} onChange={(event) => onChange(Number(event.target.value))} aria-label={`Fundido de ${label === "In" ? "entrada" : "salida"}`}>
        {FADES.map((item) => (
          <option key={item} value={item}>{item}s</option>
        ))}
      </select>
    </label>
  );
}
