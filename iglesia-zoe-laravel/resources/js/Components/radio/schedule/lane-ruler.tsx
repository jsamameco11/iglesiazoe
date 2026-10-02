import { DAY_MS, KIND_LABEL, LAYERS, clock, layerLabel, type RadioBlock } from "@/lib/radio";

/** The whole day at a glance: the main program and each overlay layer on its own lane. */
export function LaneRuler({ blocks, start, now, isToday }: { blocks: RadioBlock[]; start: number; now: number; isToday: boolean }) {
  const end = start + DAY_MS;

  return (
    <div className="mt-5">
      <div className="tl-lanes">
        {LAYERS.map((layer) => (
          <div key={layer} className="tl-lane-row" data-main={layer === 0 || undefined}>
            <span className="tl-lane-label">{layer === 0 ? "Principal" : layerLabel(layer)}</span>
            <div className="tl-ruler">
              {blocks
                .filter((block) => block.layer === layer)
                .map((block) => {
                  const left = ((Math.max(block.start, start) - start) / DAY_MS) * 100;
                  const width = ((Math.min(block.end, end) - Math.max(block.start, start)) / DAY_MS) * 100;
                  return (
                    <a
                      key={block.id}
                      href={`#bloque-${block.id}`}
                      className={`tl-block tl-kind-${block.kind}`}
                      style={{ left: `${left}%`, width: `${width}%` }}
                      title={`${clock(block.start)}–${clock(block.end)} · ${block.title}`}
                    />
                  );
                })}
              {isToday ? <span className="tl-now" style={{ left: `${((now - start) / DAY_MS) * 100}%` }} /> : null}
            </div>
          </div>
        ))}
      </div>
      <div className="tl-lane-row mt-1.5">
        <span />
        <div className="flex justify-between px-0.5 text-[10.5px] tabular-nums text-muted">
          {[0, 3, 6, 9, 12, 15, 18, 21, 24].map((hour) => (
            <span key={hour}>{String(hour).padStart(2, "0")}:00</span>
          ))}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-3 text-[11.5px] text-muted">
        {(["musica", "anuncio", "efecto", "programa", "vivo"] as const).map((kind) => (
          <span key={kind} className="inline-flex items-center gap-1.5">
            <span className={`h-2.5 w-2.5 rounded-sm tl-kind-${kind}`} /> {KIND_LABEL[kind]}
          </span>
        ))}
        <span className="text-muted/80">· Las capas suenan encima de la pista principal.</span>
      </div>
    </div>
  );
}
