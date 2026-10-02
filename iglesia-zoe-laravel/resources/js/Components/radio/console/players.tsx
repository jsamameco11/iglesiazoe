import { useRef, useState } from "react";
import { DuckIcon, PlayIcon, StopIcon } from "@/Components/radio/icons";
import { KIND_LABEL, PLAYERS, duration, shortTitle, type RadioTrack } from "@/lib/radio";
import type { ConsoleApi } from "./use-console";

const GROUPS = ["anuncio", "efecto", "programa", "musica"] as const;

/** Three players that sound at the same time as the program and as each other. */
export function Players({ api, library }: { api: ConsoleApi; library: RadioTrack[] }) {
  return (
    <div className="studio-panel">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="studio-label">Reproductores simultáneos</p>
        <p className="text-[11px] text-white/40">Cada uno suena encima del programa y de los demás.</p>
      </div>
      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        {PLAYERS.map((lane) => (
          <Cart key={lane} lane={lane} api={api} library={library} />
        ))}
      </div>
    </div>
  );
}

function Cart({ lane, api, library }: { lane: string; api: ConsoleApi; library: RadioTrack[] }) {
  const { state, now, layerAction } = api;
  const [trackId, setTrackId] = useState("");
  const [volume, setVolume] = useState(100);
  const [duck, setDuck] = useState(true);
  const timer = useRef(0);
  const playing = state.layers.find((layer) => layer.lane === lane && layer.source === "live" && layer.start <= now && now < layer.end) ?? null;
  const track = library.find((item) => item.id === trackId) ?? null;

  function choose(id: string) {
    setTrackId(id);
    const next = library.find((item) => item.id === id);
    if (next) setDuck(next.duck);
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

  return (
    <div className="cart" data-playing={playing ? "" : undefined}>
      <div className="flex items-center gap-3">
        <span className="cart-letter">{lane}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white" title={playing?.title ?? track?.title}>
            {playing ? shortTitle(playing.title, 30) : track ? shortTitle(track.title, 30) : "Sin audio"}
          </p>
          <p className="font-mono text-[11px] tabular-nums text-white/45">
            {playing ? `${duration((now - playing.start) / 1000)} / -${duration((playing.end - now) / 1000)}` : track ? `${KIND_LABEL[track.kind]} · ${duration(track.duration)}` : "Elige un audio"}
          </p>
        </div>
        {playing ? (
          <button type="button" onClick={() => layerAction({ action: "stop", lane })} className="cart-play" data-on="" aria-label={`Detener reproductor ${lane}`}>
            <StopIcon className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="button"
            disabled={!track}
            onClick={() => track && layerAction({ action: "play", id: track.id, lane, volume: String(volume), duck: duck ? "1" : "0" })}
            className="cart-play"
            aria-label={`Reproducir en ${lane}`}
          >
            <PlayIcon className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="studio-progress mt-3 !h-1">
        <span style={{ width: playing ? `${Math.min(100, ((now - playing.start) / Math.max(1, playing.end - playing.start)) * 100)}%` : "0%" }} />
      </div>

      <select value={trackId} onChange={(event) => choose(event.target.value)} className="cart-select mt-3" aria-label={`Audio del reproductor ${lane}`}>
        <option value="">Elegir de la biblioteca…</option>
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

      <div className="mt-3 flex items-center gap-3">
        <input type="range" min={0} max={100} value={volume} onChange={(event) => adjust(Number(event.target.value), duck)} className="cart-range" aria-label={`Volumen del reproductor ${lane}`} />
        <span className="w-9 text-right font-mono text-[11px] tabular-nums text-white/50">{volume}%</span>
      </div>
      <label className="mt-2 flex items-center gap-2 text-[11px] text-white/60">
        <input type="checkbox" checked={duck} onChange={(event) => adjust(volume, event.target.checked)} />
        <DuckIcon className="h-3.5 w-3.5" /> Bajar la música mientras suena
      </label>
    </div>
  );
}
