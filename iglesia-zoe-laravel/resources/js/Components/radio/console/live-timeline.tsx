import { useState, type KeyboardEvent } from "react";
import { StopIcon } from "@/Components/radio/icons";
import { send } from "@/lib/actions";
import { ALERT_AHEAD, BEDS, FADES, PLAYERS, clock, duration, laneLabel, shortTitle, type RadioItem, type RadioTrack } from "@/lib/radio";
import { useProgram, type ProgramItem } from "@/Components/radio/use-program";
import { useTrackDrop } from "./drag";
import type { ConsoleApi } from "./use-console";

const ZOOMS = [
  { span: 60_000, tick: 10_000, label: "1 min" },
  { span: 180_000, tick: 30_000, label: "3 min" },
  { span: 600_000, tick: 60_000, label: "10 min" },
  { span: 1_800_000, tick: 300_000, label: "30 min" },
  { span: 3_600_000, tick: 600_000, label: "1 h" },
  { span: 10_800_000, tick: 1_800_000, label: "3 h" },
  { span: 21_600_000, tick: 3_600_000, label: "6 h" },
  { span: 43_200_000, tick: 7_200_000, label: "12 h" },
  { span: 86_400_000, tick: 10_800_000, label: "24 h" },
] as const;

/** Share of the window that shows what already played, left of the playhead. */
const PLAYHEAD = 0.22;

/** The server resolves the program in steps this long, so the request changes only every few minutes. */
const PROGRAM_STEP = 300_000;

/** From this zoom on (or when moved away from now) the program row shows what the server resolves beyond the queue. */
const LONG_ZOOM = 3;

type Clip = {
  id: string;
  title: string;
  kind: string;
  start: number;
  end: number;
  fadeIn: number;
  fadeOut: number;
  loop?: boolean;
  duck?: boolean;
  fading?: boolean;
  layer?: string;
  /** A scheduled block the console warns about; `held` waits for the live transmission. */
  alert?: string;
  held?: boolean;
};

type Row = { id: string; label: string; hint: string; clips: Clip[]; lane?: string };

/** Left offset and width over the lanes (right of the lane heads) for a share of the window. */
function overLanes(from: number, to: number) {
  return { left: `calc(var(--cx-head) + (100% - var(--cx-head)) * ${from})`, width: `calc((100% - var(--cx-head)) * ${Math.max(0, to - from)})` };
}

/** Overlapping clips of a row go to stacked sub-lanes, like A/B rolls. */
function stack(clips: Clip[]) {
  const ends: number[] = [];
  const placed = [...clips]
    .sort((a, b) => a.start - b.start)
    .map((clip) => {
      let index = ends.findIndex((end) => end <= clip.start);
      if (index < 0) index = ends.push(0) - 1;
      ends[index] = clip.end;
      return { clip, index };
    });
  return { placed, lanes: Math.max(1, ends.length) };
}

/**
 * The program row: the live queue (exact, with its crossfades), and around it what the server
 * resolves for the rest of the window, song by song.
 */
function programClips(previous: RadioItem | null, queue: RadioItem[], now: number, resolved: ProgramItem[] = []): Clip[] {
  const live = [previous, ...queue].filter((item, index, list): item is RadioItem => !!item && list.findIndex((other) => other?.id === item.id) === index);
  const first = live[0]?.start ?? now;
  const last = live.length ? Math.max(...live.map((item) => item.end)) : now;
  const before = resolved.filter((item) => item.end <= first + 1000 && item.start < first);
  const after = resolved.filter((item) => item.start >= last - 1000);
  const items: ProgramItem[] = [...before, ...live, ...after].filter((item, index, list) => list.findIndex((other) => other.id === item.id) === index);
  return items.map((item, index) => {
    const start = item.start >= now ? item.start : Math.min(item.start, item.origin);
    const before = items[index - 1];
    return {
      id: item.id,
      title: item.title,
      kind: item.bed ? "vivo" : item.kind,
      start,
      end: item.end,
      fadeIn: before && before.end > start ? before.end - start : 0,
      fadeOut: 0,
    };
  });
}

/**
 * What is on air, in real time and lane by lane: the program with its crossfades, the
 * scheduled overlays, the background beds, the players, the pad bank and the voice. Audios
 * dropped on a live lane play right away with the console crossfade.
 */
export function LiveTimeline({ api, library, onAlert }: { api: ConsoleApi; library: RadioTrack[]; onAlert: (id: string) => void }) {
  const { state, now, blend, setBlend, talks, talking, upcoming } = api;
  const [zoom, setZoom] = useState(1);
  /** How far the window was moved from now with the arrows, in ms. */
  const [offset, setOffset] = useState(0);
  const { span, tick } = ZOOMS[zoom];
  const from = now - span * PLAYHEAD + offset;
  const to = from + span;
  const x = (ms: number) => ((ms - from) / span) * 100;
  const far = zoom >= LONG_ZOOM || offset !== 0;
  const loadFrom = far ? Math.floor(from / PROGRAM_STEP) * PROGRAM_STEP - PROGRAM_STEP : null;
  const loadTo = far ? Math.ceil(to / PROGRAM_STEP) * PROGRAM_STEP + PROGRAM_STEP : 0;
  const resolved = useProgram(loadFrom, loadTo, `${state.queue[0]?.id ?? ""}-${state.queue.length}-${api.config.autofill}-${state.live.cut}`);
  const playhead = (now - from) / span;
  const pan = (direction: number) => setOffset((value) => (direction === 0 ? 0 : Math.max(-span * 2, Math.min(36 * 3_600_000 - span, value + (direction * span) / 2))));

  const live = state.layers.filter((layer) => layer.source === "live");
  const laneClips = (lane: string): Clip[] =>
    live
      .filter((layer) => layer.lane === lane)
      .map((layer) => ({
        id: layer.id,
        title: layer.title,
        kind: layer.kind,
        start: layer.start,
        end: layer.end,
        fadeIn: (layer.fade_in ?? 0) * 1000,
        fadeOut: (layer.fade_out ?? 0) * 1000,
        loop: layer.loop && !layer.fading,
        duck: layer.duck,
        fading: layer.fading,
        layer: layer.id,
      }));

  const alertClips: Clip[] = upcoming.map((block) => {
    const start = block.held ? Math.max(now, block.start) : block.start;
    return { id: `alert-${block.id}`, title: block.title, kind: "alerta", start, end: start + block.duration * 1000, fadeIn: 0, fadeOut: 0, alert: block.id, held: block.held };
  });
  const share = (ms: number) => Math.min(1, Math.max(0, (ms - from) / span));
  const ahead = upcoming.filter((block) => !block.held);
  const beyond = ahead.filter((block) => block.start >= to);
  const held = upcoming.filter((block) => block.held).length;

  const rows: Row[] = [
    ...(upcoming.length ? [{ id: "alert", label: "Programado", hint: "", clips: alertClips }] : []),
    { id: "main", label: "Programa", hint: "Suelta aquí para ponerlo al aire ya", clips: programClips(state.previous, state.queue, now, far ? resolved ?? [] : []), lane: "main" },
    {
      id: "sched",
      label: "Capas prog.",
      hint: "Capas de la programación",
      clips: state.layers.filter((layer) => layer.source === "schedule").map((layer) => ({ id: layer.id, title: layer.title, kind: layer.kind, start: layer.start, end: layer.end, fadeIn: 0, fadeOut: 0, duck: layer.duck })),
    },
    ...[...BEDS, ...PLAYERS].map((lane) => ({ id: lane, label: laneLabel(lane).replace("Reproductor", "Rep."), hint: "Suelta un sonido", clips: laneClips(lane), lane })),
    { id: "pad", label: "Botonera", hint: "Suelta para dispararlo", clips: laneClips("pad"), lane: "pad" },
    {
      id: "voz",
      label: "Voz",
      hint: "Tu micrófono al aire",
      clips: talks.map((span, index) => ({ id: `voz-${index}`, title: "Micrófono al aire", kind: "voz", start: span.start, end: span.end ?? now, fadeIn: 0, fadeOut: 0 })),
    },
  ];

  const ticks: number[] = [];
  for (let t = Math.ceil(from / tick) * tick; t < to; t += tick) ticks.push(t);
  const liveCount = live.filter((layer) => layer.start <= now && now < layer.end).length;

  return (
    <div className="cx-panel flex min-w-0 flex-col">
      <div className="cx-head flex-wrap gap-y-2">
        <div className="flex items-center gap-2">
          <p className="studio-label">Línea de tiempo en vivo</p>
          {talking ? <span className="cx-badge" data-tone="red">Mic</span> : null}
          {liveCount ? <span className="cx-badge">{liveCount} en capas</span> : null}
          {ahead.length ? (
            <button type="button" onClick={() => onAlert(ahead[0].id)} className="cx-badge" data-tone="red" title={`«${ahead[0].title}» a las ${clock(ahead[0].start)}`}>
              Programado en {duration(Math.max(0, ahead[0].start - now) / 1000)}
            </button>
          ) : null}
          {held ? <span className="cx-badge" data-tone="red" title="Sonará cuando termine la transmisión en vivo">{held} en espera del vivo</span> : null}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="cx-seg" role="group" aria-label="Zoom">
            {ZOOMS.map((item, index) => (
              <button
                key={item.label}
                type="button"
                onClick={() => {
                  setZoom(index);
                  setOffset(0);
                }}
                data-on={zoom === index || undefined}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="cx-seg" role="group" aria-label="Mover la línea de tiempo">
            <button type="button" onClick={() => pan(-1)} title="Ver lo anterior" aria-label="Ver lo anterior">‹</button>
            <button type="button" onClick={() => pan(0)} data-on={offset === 0 || undefined} title="Volver a lo que suena ahora">Ahora</button>
            <button type="button" onClick={() => pan(1)} title="Ver lo que sigue" aria-label="Ver lo que sigue">›</button>
          </div>
          <label className="cx-seg !gap-1.5 !px-2 text-[10.5px] text-white/55" title="Empalme: fundido de entrada y cruce al soltar o enviar un sonido">
            Empalme
            <select value={blend} onChange={(event) => setBlend(Number(event.target.value))} className="cx-select-mini" aria-label="Empalme en segundos">
              {FADES.map((value) => (
                <option key={value} value={value}>{value ? `${value} s` : "Corte"}</option>
              ))}
            </select>
          </label>
          <button type="button" disabled={!liveCount} onClick={() => api.stop({}, Math.max(2, blend))} className="cx-btn" data-tone="amber" title="Funde todas las capas en vivo">Fundir todo</button>
          <button type="button" disabled={!liveCount} onClick={() => api.stop({})} className="cx-btn" data-tone="red" title="Corta todas las capas en vivo al instante">Cortar todo</button>
        </div>
      </div>

      <div className="cx-timeline mt-2">
        <div className="cx-ruler">
          <div className="cx-lane-head" />
          <div className="cx-track">
            {ticks.map((t) => (
              <span key={t} className="cx-tick" style={{ left: `${x(t)}%` }}>{clock(t, span <= 600_000)}</span>
            ))}
            {playhead >= 0 && playhead <= 1 ? <span className="cx-now-label" style={{ left: `${playhead * 100}%` }}>{clock(now, true)}</span> : null}
          </div>
        </div>
        {ahead.map((block) => {
          const zoneFrom = share(block.start - ALERT_AHEAD);
          const zoneTo = share(block.start);
          return (
            <span key={block.id}>
              {zoneTo > zoneFrom ? <span className="cx-alert-zone" style={overLanes(zoneFrom, zoneTo)} aria-hidden /> : null}
              {block.start >= from && block.start < to ? (
                <span className="cx-alert-mark" style={{ left: overLanes(zoneTo, zoneTo).left }} title={`«${block.title}» · ${clock(block.start)}`} aria-hidden />
              ) : null}
            </span>
          );
        })}
        {rows.map((row) => (
          <TimelineRow key={row.id} row={row} api={api} library={library} x={x} now={now} onAlert={onAlert} />
        ))}
        {beyond.length ? (
          <button type="button" onClick={() => onAlert(beyond[0].id)} className="cx-alert-edge" title={`«${beyond[0].title}» a las ${clock(beyond[0].start)}`}>
            {shortTitle(beyond[0].title, 24)} · {clock(beyond[0].start)} →
          </button>
        ) : null}
        {playhead >= 0 && playhead <= 1 ? <div className="cx-playhead" style={{ left: `calc(var(--cx-head) + (100% - var(--cx-head)) * ${playhead})` }} aria-hidden /> : null}
        {far && !resolved ? <span className="cx-timeline-loading">Cargando la programación…</span> : null}
      </div>
    </div>
  );
}

function TimelineRow({ row, api, library, x, now, onAlert }: { row: Row; api: ConsoleApi; library: RadioTrack[]; x: (ms: number) => number; now: number; onAlert: (id: string) => void }) {
  const { placed, lanes } = stack(row.clips);
  const drop = useTrackDrop(library, (track) => {
    if (!row.lane) return;
    if (row.lane === "main") {
      if (!window.confirm(`¿Poner «${track.title}» al aire ahora en la pista principal? Corta lo que suena y corre la programación.`)) return;
      void send("/admin/radio/lanzar", { tracks: [track.id] }).then((result) => api.setNotice(result.error ? { tone: "error", text: result.error } : { tone: "info", text: result.message ?? "Al aire." }));
      return;
    }
    void api.drop(track, row.lane);
  });
  const sounding = row.clips.filter((clip) => clip.start <= now && now < clip.end && clip.layer);
  const accepts = Boolean(row.lane);

  return (
    <div className="cx-row" data-row={row.id} {...(accepts ? drop : {})}>
      <div className="cx-lane-head">
        <span className="truncate">{row.label}</span>
        {sounding.length && row.lane && row.lane !== "main" ? (
          <span className="flex gap-0.5">
            <button type="button" onClick={() => api.stop({ lane: row.lane }, Math.max(1, api.blend))} className="cx-mini" title={`Fundir ${row.label}`} aria-label={`Fundir ${row.label}`}>↘</button>
            <button type="button" onClick={() => api.stop({ lane: row.lane })} className="cx-mini" data-tone="red" title={`Cortar ${row.label}`} aria-label={`Cortar ${row.label}`}>
              <StopIcon className="h-2.5 w-2.5" />
            </button>
          </span>
        ) : null}
      </div>
      <div className="cx-track">
        {!row.clips.length && accepts ? <span className="cx-hint">{row.hint}</span> : null}
        {placed.map(({ clip, index }) => {
          const left = x(clip.start);
          const width = Math.max(0.4, x(clip.end) - left);
          const length = Math.max(1, clip.end - clip.start);
          const playing = clip.start <= now && now < clip.end;
          return (
            <div
              key={clip.id}
              className="cx-clip"
              data-kind={clip.kind}
              data-playing={playing || undefined}
              data-fading={clip.fading || undefined}
              data-held={clip.held || undefined}
              style={{ left: `${left}%`, width: `${width}%`, top: `${(index / lanes) * 100}%`, height: `${100 / lanes}%` }}
              title={
                clip.held
                  ? `${clip.title} · en espera: suena cuando termine la transmisión en vivo`
                  : `${clip.title} · ${clock(clip.start, true)}${clip.loop ? " · en bucle" : ` – ${clock(clip.end, true)}`}`
              }
              {...(clip.alert ? { role: "button", tabIndex: 0, onClick: () => onAlert(clip.alert!), onKeyDown: (event: KeyboardEvent) => event.key === "Enter" && onAlert(clip.alert!) } : {})}
            >
              {clip.fadeIn > 0 ? <span className="cx-fade" data-dir="in" style={{ width: `${Math.min(100, (clip.fadeIn / length) * 100)}%` }} /> : null}
              {clip.fadeOut > 0 && !clip.loop ? <span className="cx-fade" data-dir="out" style={{ width: `${Math.min(100, (clip.fadeOut / length) * 100)}%` }} /> : null}
              <span className="cx-clip-body" style={{ marginLeft: left < 0 ? `${Math.min(95, (-left / width) * 100)}%` : 0 }}>
                <span className="truncate">{clip.held ? "⏸ " : clip.loop ? "⟲ " : ""}{shortTitle(clip.title, 40)}</span>
                {clip.alert && !clip.held && clip.start > now ? <span className="cx-clip-time">en {duration((clip.start - now) / 1000)}</span> : null}
                {clip.held ? <span className="cx-clip-time">tras el vivo</span> : null}
                {playing && !clip.loop && clip.kind !== "voz" && !clip.alert ? <span className="cx-clip-time">-{duration((clip.end - now) / 1000)}</span> : null}
              </span>
              {clip.layer && playing && !clip.fading ? (
                <span className="cx-clip-tools">
                  <button type="button" onClick={() => api.stop({ layer: clip.layer }, Math.max(1, api.blend))} title="Fundir" aria-label={`Fundir ${clip.title}`}>↘</button>
                  <button type="button" onClick={() => api.stop({ layer: clip.layer })} title="Cortar" aria-label={`Cortar ${clip.title}`}>×</button>
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
