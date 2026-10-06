import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ProgramItem } from "@/Components/radio/use-program";
import { DAY_MS, KIND_LABEL, LAYERS, clock, layerLabel, type RadioBlock } from "@/lib/radio";

const HOUR = 3_600_000;

/** Preset zooms, in pixels per hour (0 fits the whole day). */
const ZOOMS = [
  { label: "Día completo", perHour: 0 },
  { label: "Por hora", perHour: 360 },
  { label: "Por 30 min", perHour: 900 },
  { label: "Por 10 min", perHour: 2_700 },
  { label: "Por minuto", perHour: 21_600 },
] as const;

const MAX_PER_HOUR = 43_200;

/** Steps of the axis, from the widest; the labels take the first one at least LABEL_GAP px apart. */
const STEPS = [3 * HOUR, HOUR, 1_800_000, 900_000, 600_000, 300_000, 60_000, 30_000, 10_000];

const LABEL_GAP = 64;

const MINOR_GAP = 10;

/** A song of the automatic music is labelled once it is this wide. */
const SONG_LABEL = 70;

/**
 * The whole day lane by lane: the main program (with the songs the automatic music will play)
 * and each overlay layer. The zoom goes from the whole day to one minute per screen width, with
 * the presets, the slider or Ctrl + wheel, and the day scrolls sideways.
 */
export function LaneRuler({ blocks, start, now, isToday, songs = [] }: { blocks: RadioBlock[]; start: number; now: number; isToday: boolean; songs?: ProgramItem[] }) {
  const end = start + DAY_MS;
  const scroller = useRef<HTMLDivElement | null>(null);
  const [viewport, setViewport] = useState({ width: 0, left: 0 });
  const [perHour, setPerHour] = useState(0);
  /** Moment to keep at the same spot of the screen when the zoom changes. */
  const anchor = useRef<{ at: number; x: number } | null>(null);
  const fit = viewport.width / 24;
  const scale = Math.max(fit, perHour) / HOUR;
  const width = Math.max(viewport.width, DAY_MS * scale);
  const pos = (ms: number) => (Math.min(end, Math.max(start, ms)) - start) * scale;

  useEffect(() => {
    const element = scroller.current;
    if (!element) return;
    const measure = () => setViewport({ width: element.clientWidth, left: element.scrollLeft });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    const element = scroller.current;
    if (!element || !anchor.current) return;
    element.scrollLeft = (anchor.current.at - start) * scale - anchor.current.x;
    anchor.current = null;
    setViewport({ width: element.clientWidth, left: element.scrollLeft });
  }, [scale, start]);

  function zoomTo(next: number, x = viewport.width / 2) {
    const element = scroller.current;
    const value = next <= fit ? 0 : Math.min(MAX_PER_HOUR, next);
    if (element) {
      const centred = isToday && perHour === 0 && value > 0 ? now : start + (element.scrollLeft + x) / scale;
      anchor.current = { at: centred, x };
    }
    setPerHour(value);
  }

  function showNow() {
    const element = scroller.current;
    if (!element) return;
    element.scrollTo({ left: Math.max(0, pos(now) - element.clientWidth / 3), behavior: "smooth" });
  }

  useEffect(() => {
    const element = scroller.current;
    if (!element) return;
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      const rect = element.getBoundingClientRect();
      zoomTo(Math.max(fit, perHour || fit) * (event.deltaY < 0 ? 1.25 : 0.8), event.clientX - rect.left);
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  });

  const label = [...STEPS].reverse().find((step) => step * scale >= LABEL_GAP) ?? STEPS[0];
  const minor = [...STEPS].reverse().find((step) => step * scale >= MINOR_GAP) ?? HOUR;
  const visibleFrom = start + Math.max(0, viewport.left - 200) / scale;
  const visibleTo = start + (viewport.left + viewport.width + 200) / scale;
  const ticks: number[] = [];
  for (let at = start + Math.ceil((visibleFrom - start) / minor) * minor; at <= Math.min(end, visibleTo); at += minor) ticks.push(at);
  const slider = perHour === 0 ? 0 : Math.round((Math.log(perHour / Math.max(1, fit)) / Math.log(MAX_PER_HOUR / Math.max(1, fit))) * 100);
  const autoSongs = songs.filter((song) => !song.slot && song.end > start && song.start < end);

  return (
    <div className="mt-5">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="tl-zoom-seg" role="group" aria-label="Zoom de la línea de tiempo">
          {ZOOMS.map((zoom) => (
            <button key={zoom.label} type="button" onClick={() => zoomTo(zoom.perHour)} data-on={(zoom.perHour === 0 ? perHour === 0 : Math.abs(perHour - zoom.perHour) < 1) || undefined}>
              {zoom.label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-[11.5px] font-semibold text-muted">
          Zoom
          <input
            type="range"
            min={0}
            max={100}
            value={slider}
            onChange={(event) => {
              const share = Number(event.target.value) / 100;
              zoomTo(share === 0 ? 0 : Math.max(1, fit) * Math.pow(MAX_PER_HOUR / Math.max(1, fit), share));
            }}
            className="w-32 accent-ink"
            aria-label="Zoom libre"
          />
        </label>
        {isToday && perHour > 0 ? (
          <button type="button" onClick={showNow} className="rounded-full border border-line bg-white px-3 py-1 text-[11.5px] font-semibold text-ink hover:border-ink/30">
            Ir a ahora
          </button>
        ) : null}
        <span className="text-[11px] text-muted/80">Ctrl + rueda del mouse para acercar o alejar.</span>
      </div>

      <div className="tl-zoom">
        <div className="tl-zoom-labels">
          {LAYERS.map((layer) => (
            <span key={layer} className="tl-lane-label" data-main={layer === 0 || undefined}>{layer === 0 ? "Principal" : layerLabel(layer)}</span>
          ))}
          <span />
        </div>
        <div ref={scroller} className="tl-zoom-scroll" onScroll={(event) => setViewport({ width: event.currentTarget.clientWidth, left: event.currentTarget.scrollLeft })}>
          <div className="tl-zoom-canvas" style={{ width }}>
            {LAYERS.map((layer) => (
              <div key={layer} className="tl-ruler" data-main={layer === 0 || undefined} style={{ ["--tl-hour" as string]: `${HOUR * scale}px` }}>
                {blocks
                  .filter((block) => block.layer === layer)
                  .map((block) => {
                    const left = pos(block.start);
                    const size = Math.max(3, pos(block.end) - left);
                    const labelled = layer > 0 || block.kind !== "automatica";
                    return (
                      <a
                        key={block.id}
                        href={`#bloque-${block.id}`}
                        className={`tl-block tl-kind-${block.kind}`}
                        style={{ left, width: size }}
                        title={`${clock(block.start)}–${clock(block.end)} · ${block.title}`}
                      >
                        {labelled && size >= SONG_LABEL ? <span className="tl-block-label">{block.title}</span> : null}
                      </a>
                    );
                  })}
                {layer === 0
                  ? autoSongs.map((song) => {
                      const left = pos(song.start);
                      const size = Math.max(1, pos(song.end) - left);
                      return (
                        <span key={song.id} className="tl-song" style={{ left, width: size }} title={`${clock(song.start)}–${clock(song.end)} · ${song.title}${song.artist ? ` · ${song.artist}` : ""}`}>
                          {size >= SONG_LABEL ? <span className="tl-block-label">{song.title}</span> : null}
                        </span>
                      );
                    })
                  : null}
                {isToday && now >= start && now < end ? <span className="tl-now" style={{ left: pos(now) }} /> : null}
              </div>
            ))}
            <div className="tl-axis">
              {ticks.map((at) => {
                const major = (at - start) % label === 0;
                return (
                  <span key={at} className="tl-tick" data-major={major || undefined} style={{ left: pos(at) }}>
                    {major ? <span>{clock(at, label < 60_000)}</span> : null}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-3 text-[11.5px] text-muted">
        {(["musica", "anuncio", "efecto", "programa", "vivo"] as const).map((kind) => (
          <span key={kind} className="inline-flex items-center gap-1.5">
            <span className={`h-2.5 w-2.5 rounded-sm tl-kind-${kind}`} /> {KIND_LABEL[kind]}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <span className="tl-song-key h-2.5 w-2.5 rounded-sm" /> Canción del modo automático
        </span>
        <span className="text-muted/80">· Las capas suenan encima de la pista principal.</span>
      </div>
    </div>
  );
}
