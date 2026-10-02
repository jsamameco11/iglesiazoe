import type { ReactNode } from "react";
import { DuckIcon, StopIcon } from "@/Components/radio/icons";
import { KIND_LABEL, clock, currentItem, duration, laneLabel, nextItem, shortTitle, type RadioItem, type RadioLayer } from "@/lib/radio";
import type { ConsoleApi } from "./use-console";

function percent(now: number, start: number, end: number) {
  return Math.min(100, Math.max(0, ((now - start) / Math.max(1, end - start)) * 100));
}

function itemLabel(item: RadioItem) {
  return item.bed ? "Fondo en vivo" : KIND_LABEL[item.kind];
}

function Slot({ label, item, tone, children }: { label: string; item: RadioItem | null; tone: "past" | "now" | "next"; children?: ReactNode }) {
  return (
    <div className="deck-slot" data-tone={tone}>
      <p className="studio-label">{label}</p>
      {item ? (
        <>
          <p className="deck-title" title={item.title}>{shortTitle(item.title, tone === "now" ? 34 : 24)}</p>
          <p className="deck-sub">{item.artist ? shortTitle(item.artist, 28) : itemLabel(item)}</p>
        </>
      ) : (
        <p className="deck-sub mt-2">—</p>
      )}
      {children}
    </div>
  );
}

/**
 * The program as a three-deck view: the song that just played, the one on air and the one
 * that comes in next (with the crossfade countdown), plus every layer sounding on top.
 */
export function MusicDeck({ api }: { api: ConsoleApi }) {
  const { state, now, config, layerAction } = api;
  const item = currentItem(state.queue, now);
  const index = item ? state.queue.findIndex((entry) => entry.id === item.id) : -1;
  const previous = index > 0 ? state.queue[index - 1] : state.previous;
  const next = nextItem(state.queue, now);
  const later = state.queue.filter((entry) => entry.start > now && entry.id !== next?.id).slice(0, 3);
  const overlap = item && next && item.end > next.start ? (item.end - next.start) / 1000 : 0;
  const onTop = state.layers.filter((layer) => layer.start <= now && now < layer.end);
  const ducking = onTop.some((layer) => layer.duck);

  return (
    <div className="studio-panel">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="studio-label">Música de fondo · programa</p>
        <div className="flex items-center gap-2 text-[11px] text-white/45">
          <span>Empalme {config.crossfade} s</span>
          {ducking ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/15 px-2 py-0.5 font-semibold text-amber-200">
              <DuckIcon className="h-3.5 w-3.5" /> Música al {config.duck_level}%
            </span>
          ) : null}
        </div>
      </div>

      <div className="deck-row mt-3">
        <Slot label="Anterior" item={previous} tone="past">
          {previous ? <p className="deck-time">terminó {clock(Math.min(previous.end, now))}</p> : null}
        </Slot>
        <Slot label={item?.block ? `Ahora · ${shortTitle(item.block, 18)}` : "Sonando ahora"} item={item} tone="now">
          {item ? (
            <>
              <div className="studio-progress mt-3">
                <span style={{ width: `${percent(now, item.origin, item.end)}%` }} />
              </div>
              <div className="deck-time flex justify-between">
                <span>{duration((now - item.origin) / 1000)}</span>
                <span>-{duration((item.end - now) / 1000)}</span>
              </div>
            </>
          ) : (
            <p className="deck-sub mt-2">{config.on_air ? "Silencio: no hay nada programado ni música continua." : "Radio fuera del aire."}</p>
          )}
        </Slot>
        <Slot label="Siguiente" item={next} tone="next">
          {next ? (
            <p className="deck-time">
              {overlap > 0.5 ? `empalma en ${duration((next.start - now) / 1000)} · fundido ${Math.round(overlap)} s` : `entra ${clock(next.start, true)}`}
            </p>
          ) : null}
        </Slot>
      </div>

      {later.length ? (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {later.map((entry) => (
            <li key={entry.id} className="rounded-full bg-white/5 px-2.5 py-1 text-[11px] text-white/55" title={entry.title}>
              <span className="font-mono tabular-nums text-white/35">{clock(entry.start)}</span> {shortTitle(entry.title, 22)}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-4 border-t border-white/10 pt-3">
        <p className="studio-label">Sonando encima</p>
        {onTop.length ? (
          <ul className="mt-2 space-y-1.5">
            {onTop.map((layer) => (
              <OnTop key={layer.id} layer={layer} now={now} onStop={() => layerAction({ action: "stop", layer: layer.id })} />
            ))}
          </ul>
        ) : (
          <p className="mt-1.5 text-[12px] text-white/35">Nada por ahora. Los efectos, los reproductores y las capas programadas aparecen aquí mientras suenan.</p>
        )}
      </div>
    </div>
  );
}

function OnTop({ layer, now, onStop }: { layer: RadioLayer; now: number; onStop: () => void }) {
  return (
    <li className="layer-chip">
      <span className="layer-lane">{laneLabel(layer.lane)}</span>
      <span className="min-w-0 flex-1 truncate text-white/85" title={layer.title}>{shortTitle(layer.title, 30)}</span>
      {layer.duck ? <DuckIcon className="h-3.5 w-3.5 shrink-0 text-amber-300" /> : null}
      <span className="w-10 shrink-0 text-right font-mono text-[11px] tabular-nums text-white/45">-{duration((layer.end - now) / 1000)}</span>
      {layer.source === "live" ? (
        <button type="button" onClick={onStop} className="layer-stop" aria-label={`Detener ${layer.title}`}>
          <StopIcon className="h-3 w-3" />
        </button>
      ) : null}
      <span className="layer-bar" style={{ width: `${percent(now, layer.start, layer.end)}%` }} />
    </li>
  );
}
