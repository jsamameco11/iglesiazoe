import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { mergeCuts, preciseTime, type Cut } from "./recipe";

/** Most pixels a second of audio may take when zoomed in. */
export const MAX_PIXELS_PER_SECOND = 600;

const HEIGHT = 176;
const RULER = 22;
const EDGE = 7;

const color = {
  background: "#fcfbf8",
  ruler: "#f3efe8",
  rulerText: "#8a837a",
  tick: "rgba(42,39,36,0.18)",
  wave: "#3a3530",
  played: "#e0662f",
  cutWave: "rgba(42,39,36,0.18)",
  cutFill: "rgba(220,38,38,0.07)",
  cutHatch: "rgba(220,38,38,0.32)",
  cutEdge: "rgba(220,38,38,0.75)",
  selection: "rgba(37,99,235,0.13)",
  selectionEdge: "#2563eb",
  fade: "rgba(245,158,11,0.9)",
  fadeFill: "rgba(245,158,11,0.10)",
  playhead: "#e0662f",
  center: "rgba(42,39,36,0.08)",
};

type Drag =
  | { type: "select"; anchor: number; x: number; moved: boolean }
  | { type: "selection"; edge: 0 | 1 }
  | { type: "cut"; index: number; edge: 0 | 1 }
  | { type: "scrub" };

type Props = {
  peaks: Int8Array | null;
  perSecond: number;
  duration: number;
  cuts: Cut[];
  selection: Cut | null;
  time: number;
  fades: { in: Cut | null; out: Cut | null };
  zoom: number;
  follow: boolean;
  onZoom: (zoom: number) => void;
  onSeek: (time: number) => void;
  onSelect: (range: Cut | null) => void;
  onCuts: (cuts: Cut[]) => void;
};

/** Ticks of the ruler: the first step that leaves room for a label. */
function rulerStep(pixelsPerSecond: number) {
  return [0.1, 0.2, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 1200].find((step) => step * pixelsPerSecond >= 74) ?? 1800;
}

function rulerLabel(seconds: number, step: number) {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds - minutes * 60;
  return `${minutes}:${step < 1 ? rest.toFixed(1).padStart(4, "0") : String(Math.round(rest)).padStart(2, "0")}`;
}

/** Lowest and highest sample between two moments (each slice of the peaks holds a min and a max). */
function range(peaks: Int8Array, perSecond: number, from: number, to: number): [number, number] {
  const slices = peaks.length / 2;
  const first = Math.max(0, Math.floor(from * perSecond));
  const last = Math.min(slices, Math.max(first + 1, Math.ceil(to * perSecond)));
  if (first >= slices) return [0, 0];
  let low = 0;
  let high = 0;
  for (let index = first; index < last; index++) {
    low = Math.min(low, peaks[index * 2]);
    high = Math.max(high, peaks[index * 2 + 1]);
  }
  return [low / 128, high / 128];
}

function drawWave(context: CanvasRenderingContext2D, peaks: Int8Array, perSecond: number, width: number, top: number, height: number, start: number, pixelsPerSecond: number, paint: (time: number) => string) {
  const middle = top + height / 2;
  const scale = (height / 2) * 0.94;
  let current = "";
  for (let x = 0; x < width; x++) {
    const from = start + x / pixelsPerSecond;
    const [low, high] = range(peaks, perSecond, from, from + 1 / pixelsPerSecond);
    const fill = paint(from);
    if (fill !== current) {
      context.fillStyle = fill;
      current = fill;
    }
    const y1 = middle - Math.max(high * scale, 0.5);
    const y2 = middle - Math.min(low * scale, -0.5);
    context.fillRect(x, y1, 1, y2 - y1);
  }
}

export function Waveform({ peaks, perSecond, duration, cuts, selection, time, fades, zoom, follow, onZoom, onSeek, onSelect, onCuts }: Props) {
  const scroller = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [width, setWidth] = useState(0);
  const [scroll, setScroll] = useState(0);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [draft, setDraft] = useState<{ cuts?: Cut[]; selection?: Cut | null } | null>(null);
  const [hover, setHover] = useState<{ x: number; time: number } | null>(null);
  const [cursor, setCursor] = useState("crosshair");

  const shownCuts = draft?.cuts ?? cuts;
  const shownSelection = draft && "selection" in draft ? (draft.selection ?? null) : selection;
  const pixelsPerSecond = width > 0 && duration > 0 ? (width / duration) * zoom : 1;
  const total = Math.max(width, duration * pixelsPerSecond);
  const start = scroll / pixelsPerSecond;

  useLayoutEffect(() => {
    const element = scroller.current;
    if (!element) return;
    const observer = new ResizeObserver(() => setWidth(element.clientWidth));
    observer.observe(element);
    setWidth(element.clientWidth);
    return () => observer.disconnect();
  }, []);

  const pending = useRef<{ zoom: number; anchor: number; x: number } | null>(null);

  /** Zooms keeping a moment under the same pixel. */
  const zoomAround = useCallback(
    (next: number, anchor: number, x: number) => {
      const fit = width / Math.max(duration, 0.001);
      const limit = Math.max(1, MAX_PIXELS_PER_SECOND / Math.max(fit, 0.001));
      const value = Math.max(1, Math.min(limit, next));
      pending.current = { zoom: value, anchor, x };
      onZoom(value);
    },
    [duration, onZoom, width],
  );

  useLayoutEffect(() => {
    const element = scroller.current;
    const wanted = pending.current;
    if (!element || !wanted || wanted.zoom !== zoom) return;
    pending.current = null;
    element.scrollLeft = Math.max(0, wanted.anchor * pixelsPerSecond - wanted.x);
    setScroll(element.scrollLeft);
  }, [zoom, pixelsPerSecond]);

  /** Zoom from the toolbar keeps the playhead in view. */
  const lastZoom = useRef(zoom);
  useLayoutEffect(() => {
    const element = scroller.current;
    if (!element || lastZoom.current === zoom) return;
    lastZoom.current = zoom;
    if (pending.current) return;
    element.scrollLeft = Math.max(0, time * pixelsPerSecond - width / 2);
    setScroll(element.scrollLeft);
  }, [zoom, pixelsPerSecond, time, width]);

  useEffect(() => {
    const element = scroller.current;
    if (!element) return;
    const wheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
        const box = element.getBoundingClientRect();
        const x = event.clientX - box.left;
        zoomAround(zoom * (event.deltaY < 0 ? 1.25 : 0.8), (element.scrollLeft + x) / pixelsPerSecond, x);
      } else if (zoom > 1 && Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
        event.preventDefault();
        element.scrollLeft += event.deltaY;
      }
    };
    element.addEventListener("wheel", wheel, { passive: false });
    return () => element.removeEventListener("wheel", wheel);
  }, [pixelsPerSecond, zoom, zoomAround]);

  /** While playing, the view follows the playhead like a timeline does. */
  useEffect(() => {
    const element = scroller.current;
    if (!element || !follow || drag || zoom <= 1) return;
    const x = time * pixelsPerSecond - element.scrollLeft;
    if (x > width * 0.92 || x < 0) {
      element.scrollLeft = Math.max(0, time * pixelsPerSecond - width * 0.12);
      setScroll(element.scrollLeft);
    }
  }, [time, follow, drag, zoom, pixelsPerSecond, width]);

  useEffect(() => {
    const element = canvas.current;
    if (!element || width === 0) return;
    const ratio = window.devicePixelRatio || 1;
    if (element.width !== Math.round(width * ratio)) element.width = Math.round(width * ratio);
    if (element.height !== Math.round(HEIGHT * ratio)) element.height = Math.round(HEIGHT * ratio);
    const context = element.getContext("2d");
    if (!context) return;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    const x = (seconds: number) => (seconds - start) * pixelsPerSecond;
    const waveTop = RULER + 6;
    const waveHeight = HEIGHT - waveTop - 6;

    context.fillStyle = color.background;
    context.fillRect(0, 0, width, HEIGHT);
    context.fillStyle = color.center;
    context.fillRect(0, waveTop + waveHeight / 2, width, 1);

    for (const [from, to] of shownCuts) {
      const left = x(from);
      const right = x(to);
      if (right < 0 || left > width) continue;
      context.fillStyle = color.cutFill;
      context.fillRect(left, RULER, right - left, HEIGHT - RULER);
    }

    if (peaks) {
      drawWave(context, peaks, perSecond, width, waveTop, waveHeight, start, pixelsPerSecond, (moment) => {
        const cut = shownCuts.some(([from, to]) => moment >= from && moment < to);
        return cut ? color.cutWave : moment < time ? color.played : color.wave;
      });
    } else {
      context.fillStyle = color.rulerText;
      context.font = "600 12px ui-sans-serif, system-ui";
      context.textAlign = "center";
      context.fillText("Dibujando la onda del audio…", width / 2, waveTop + waveHeight / 2 - 8);
    }

    context.save();
    for (const [from, to] of shownCuts) {
      const left = x(from);
      const right = x(to);
      if (right < 0 || left > width) continue;
      context.save();
      context.beginPath();
      context.rect(left, RULER, right - left, HEIGHT - RULER);
      context.clip();
      context.strokeStyle = color.cutHatch;
      context.lineWidth = 1;
      for (let line = left - HEIGHT; line < right; line += 9) {
        context.beginPath();
        context.moveTo(line, HEIGHT);
        context.lineTo(line + HEIGHT, RULER);
        context.stroke();
      }
      context.restore();
      context.fillStyle = color.cutEdge;
      context.fillRect(left - 1, RULER, 2, HEIGHT - RULER);
      context.fillRect(right - 1, RULER, 2, HEIGHT - RULER);
      if (right - left > 76) {
        const label = `✂ Cortado · ${preciseTime(to - from)}`;
        context.font = "700 11px ui-sans-serif, system-ui";
        const textWidth = context.measureText(label).width + 16;
        const center = Math.max(left + textWidth / 2 + 4, Math.min(right - textWidth / 2 - 4, width / 2));
        context.fillStyle = "rgba(255,255,255,0.92)";
        context.beginPath();
        context.roundRect(center - textWidth / 2, RULER + 8, textWidth, 20, 10);
        context.fill();
        context.fillStyle = "#b91c1c";
        context.textAlign = "center";
        context.fillText(label, center, RULER + 22);
      }
    }
    context.restore();

    for (const [zone, rising] of [[fades.in, true], [fades.out, false]] as const) {
      if (!zone) continue;
      const left = x(zone[0]);
      const right = x(zone[1]);
      if (right < 0 || left > width) continue;
      context.fillStyle = color.fadeFill;
      context.beginPath();
      context.moveTo(left, HEIGHT - 4);
      context.lineTo(rising ? right : left, waveTop);
      context.lineTo(right, rising ? waveTop : HEIGHT - 4);
      context.lineTo(right, HEIGHT - 4);
      context.closePath();
      context.fill();
      context.strokeStyle = color.fade;
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(left, rising ? HEIGHT - 4 : waveTop);
      context.lineTo(right, rising ? waveTop : HEIGHT - 4);
      context.stroke();
    }

    if (shownSelection) {
      const left = x(shownSelection[0]);
      const right = x(shownSelection[1]);
      context.fillStyle = color.selection;
      context.fillRect(left, RULER, right - left, HEIGHT - RULER);
      context.fillStyle = color.selectionEdge;
      for (const edge of [left, right]) {
        context.fillRect(edge - 1, RULER, 2, HEIGHT - RULER);
        context.beginPath();
        context.roundRect(edge - 4, RULER + (HEIGHT - RULER) / 2 - 14, 8, 28, 4);
        context.fill();
      }
      const label = preciseTime(shownSelection[1] - shownSelection[0]);
      context.font = "700 11px ui-sans-serif, system-ui";
      const textWidth = context.measureText(label).width + 14;
      const center = Math.max(textWidth / 2 + 2, Math.min(width - textWidth / 2 - 2, (left + right) / 2));
      context.fillStyle = color.selectionEdge;
      context.beginPath();
      context.roundRect(center - textWidth / 2, HEIGHT - 24, textWidth, 18, 9);
      context.fill();
      context.fillStyle = "#fff";
      context.textAlign = "center";
      context.fillText(label, center, HEIGHT - 11);
    }

    context.fillStyle = color.ruler;
    context.fillRect(0, 0, width, RULER);
    const step = rulerStep(pixelsPerSecond);
    context.font = "600 10px ui-sans-serif, system-ui";
    context.textAlign = "left";
    for (let tick = Math.floor(start / step) * step; tick <= start + width / pixelsPerSecond; tick += step) {
      const position = Math.round(x(tick)) + 0.5;
      context.fillStyle = color.tick;
      context.fillRect(position, RULER - 8, 1, 8);
      context.fillRect(position, RULER, 1, HEIGHT - RULER);
      context.fillStyle = color.rulerText;
      context.fillText(rulerLabel(Math.max(0, tick), step), position + 4, 13);
      const half = Math.round(x(tick + step / 2)) + 0.5;
      context.fillStyle = color.tick;
      context.fillRect(half, RULER - 4, 1, 4);
    }

    if (hover && !drag) {
      context.fillStyle = "rgba(42,39,36,0.35)";
      context.fillRect(Math.round(hover.x), RULER, 1, HEIGHT - RULER);
    }

    const head = x(time);
    if (head >= -2 && head <= width + 2) {
      context.fillStyle = color.playhead;
      context.fillRect(head - 1, 0, 2, HEIGHT);
      context.beginPath();
      context.moveTo(head - 6, 0);
      context.lineTo(head + 6, 0);
      context.lineTo(head, 9);
      context.closePath();
      context.fill();
    }
  }, [peaks, perSecond, width, start, pixelsPerSecond, shownCuts, shownSelection, time, fades, hover, drag]);

  const timeAt = (clientX: number) => {
    const box = canvas.current!.getBoundingClientRect();
    return Math.max(0, Math.min(duration, start + (clientX - box.left) / pixelsPerSecond));
  };

  /** What is under the pointer: an edge of the selection, an edge of a cut, the ruler or the audio. */
  const hit = (clientX: number, clientY: number): Drag | null => {
    const box = canvas.current!.getBoundingClientRect();
    const px = clientX - box.left;
    if (clientY - box.top < RULER) return { type: "scrub" };
    const near = (seconds: number) => Math.abs((seconds - start) * pixelsPerSecond - px) <= EDGE;
    if (shownSelection) {
      if (near(shownSelection[0])) return { type: "selection", edge: 0 };
      if (near(shownSelection[1])) return { type: "selection", edge: 1 };
    }
    for (let index = 0; index < shownCuts.length; index++) {
      if (shownCuts[index][0] > 0 && near(shownCuts[index][0])) return { type: "cut", index, edge: 0 };
      if (shownCuts[index][1] < duration && near(shownCuts[index][1])) return { type: "cut", index, edge: 1 };
    }
    return null;
  };

  function pointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const at = timeAt(event.clientX);
    const target = hit(event.clientX, event.clientY);
    if (target?.type === "scrub") {
      onSeek(at);
      setDrag(target);
      return;
    }
    if (target) {
      setDrag(target);
      return;
    }
    if (event.shiftKey && selection) {
      onSelect(at < selection[0] ? [at, selection[1]] : [selection[0], at]);
      return;
    }
    setDrag({ type: "select", anchor: at, x: event.clientX, moved: false });
  }

  function autoScroll(clientX: number) {
    const element = scroller.current;
    if (!element || zoom <= 1) return;
    const box = element.getBoundingClientRect();
    if (clientX < box.left + 24) element.scrollLeft -= 18;
    else if (clientX > box.right - 24) element.scrollLeft += 18;
  }

  function pointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    const at = timeAt(event.clientX);
    const box = canvas.current!.getBoundingClientRect();
    setHover({ x: event.clientX - box.left, time: at });
    if (!drag) {
      const target = hit(event.clientX, event.clientY);
      setCursor(target?.type === "scrub" ? "pointer" : target ? "ew-resize" : "crosshair");
      return;
    }
    autoScroll(event.clientX);
    if (drag.type === "scrub") {
      onSeek(at);
    } else if (drag.type === "select") {
      const moved = drag.moved || Math.abs(event.clientX - drag.x) > 3;
      if (moved !== drag.moved) setDrag({ ...drag, moved });
      if (moved) setDraft({ selection: [Math.min(drag.anchor, at), Math.max(drag.anchor, at)] });
    } else if (drag.type === "selection" && selection) {
      const next: Cut = [...selection];
      next[drag.edge] = at;
      setDraft({ selection: [Math.min(...next), Math.max(...next)] });
    } else if (drag.type === "cut") {
      const next = cuts.map((cut) => [...cut] as Cut);
      const cut = next[drag.index];
      const previous = next[drag.index - 1];
      const following = next[drag.index + 1];
      if (drag.edge === 0) cut[0] = Math.max(previous ? previous[1] + 0.1 : 0, Math.min(at, cut[1] - 0.05));
      else cut[1] = Math.min(following ? following[0] - 0.1 : duration, Math.max(at, cut[0] + 0.05));
      setDraft({ cuts: next });
    }
  }

  function pointerUp(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drag) return;
    const at = timeAt(event.clientX);
    if (drag.type === "select") {
      if (!drag.moved) {
        onSelect(null);
        onSeek(at);
      } else if (draft?.selection) {
        onSelect(draft.selection[1] - draft.selection[0] >= 0.05 ? draft.selection : null);
      }
    } else if (drag.type === "selection" && draft?.selection) {
      onSelect(draft.selection);
    } else if (drag.type === "cut" && draft?.cuts) {
      onCuts(mergeCuts(draft.cuts, duration));
    }
    setDrag(null);
    setDraft(null);
  }

  const visible = width / pixelsPerSecond;

  return (
    <div className="select-none">
      <div
        ref={scroller}
        onScroll={(event) => setScroll(event.currentTarget.scrollLeft)}
        className={`relative overflow-y-hidden rounded-2xl border border-line bg-[#fcfbf8] [scrollbar-width:thin] ${zoom > 1 ? "overflow-x-auto" : "overflow-x-hidden"}`}
      >
        <div style={{ width: total, height: HEIGHT }}>
          <canvas
            ref={canvas}
            onPointerDown={pointerDown}
            onPointerMove={pointerMove}
            onPointerUp={pointerUp}
            onPointerCancel={() => {
              setDrag(null);
              setDraft(null);
            }}
            onPointerLeave={() => setHover(null)}
            onDoubleClick={(event) => {
              const at = timeAt(event.clientX);
              const index = shownCuts.findIndex(([from, to]) => at >= from && at < to);
              if (index >= 0) onSelect(shownCuts[index]);
            }}
            style={{ width, height: HEIGHT, cursor, touchAction: "none" }}
            className="sticky left-0 block"
            aria-label="Onda del audio: arrastra para seleccionar una parte"
          />
        </div>
        {hover && !drag && (
          <span className="pointer-events-none absolute top-[26px] rounded-md bg-ink px-1.5 py-0.5 text-[10.5px] font-semibold tabular-nums text-white" style={{ left: Math.min(width - 56, hover.x + 8) }}>
            {preciseTime(hover.time)}
          </span>
        )}
      </div>
      {zoom > 1 && peaks && <Overview peaks={peaks} perSecond={perSecond} duration={duration} cuts={shownCuts} time={time} view={[start, start + visible]} onMove={(center) => {
        const element = scroller.current;
        if (!element) return;
        element.scrollLeft = Math.max(0, (center - visible / 2) * pixelsPerSecond);
        setScroll(element.scrollLeft);
      }} />}
    </div>
  );
}

/** The whole audio in small, with the part shown above framed; click or drag to move there. */
function Overview({ peaks, perSecond, duration, cuts, time, view, onMove }: { peaks: Int8Array; perSecond: number; duration: number; cuts: Cut[]; time: number; view: Cut; onMove: (center: number) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [width, setWidth] = useState(0);
  const height = 38;

  useLayoutEffect(() => {
    const element = canvas.current?.parentElement;
    if (!element) return;
    const observer = new ResizeObserver(() => setWidth(element.clientWidth));
    observer.observe(element);
    setWidth(element.clientWidth);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const element = canvas.current;
    if (!element || width === 0) return;
    const ratio = window.devicePixelRatio || 1;
    element.width = Math.round(width * ratio);
    element.height = Math.round(height * ratio);
    const context = element.getContext("2d");
    if (!context) return;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    const scale = width / duration;
    context.fillStyle = "#f3efe8";
    context.fillRect(0, 0, width, height);
    drawWave(context, peaks, perSecond, width, 3, height - 6, 0, scale, (moment) => (cuts.some(([from, to]) => moment >= from && moment < to) ? "rgba(220,38,38,0.35)" : "rgba(42,39,36,0.55)"));
    context.fillStyle = "rgba(37,99,235,0.12)";
    context.strokeStyle = "#2563eb";
    context.lineWidth = 1.5;
    context.fillRect(view[0] * scale, 0, (view[1] - view[0]) * scale, height);
    context.strokeRect(view[0] * scale + 0.75, 0.75, Math.max(2, (view[1] - view[0]) * scale - 1.5), height - 1.5);
    context.fillStyle = "#e0662f";
    context.fillRect(time * scale - 1, 0, 2, height);
  }, [peaks, perSecond, duration, cuts, time, view, width]);

  const move = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    onMove(((event.clientX - box.left) / box.width) * duration);
  };

  return (
    <div className="mt-2">
      <canvas
        ref={canvas}
        style={{ width, height, touchAction: "none" }}
        className="block cursor-pointer rounded-xl border border-line"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          move(event);
        }}
        onPointerMove={(event) => event.buttons === 1 && move(event)}
        aria-label="Vista general del audio"
      />
    </div>
  );
}
