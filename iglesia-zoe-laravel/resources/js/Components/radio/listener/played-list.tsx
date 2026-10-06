import { Rise } from "@/Components/motion/rise";
import type { CopyKey } from "@/lib/copy";
import { KIND_LABEL, clock, currentItem, hidesSong, longDuration, type RadioItem, type RadioKind, type RadioState } from "@/lib/radio";

/** Rows the listener sees: what is on air and what sounded just before it. */
const ROWS = 4;

type Row = { id: string; start: number; end: number; title: string; note: string; kind: RadioKind; now: boolean; continuous: boolean };

/** What sounded and what is sounding, oldest first: songs by name (or as continuous music when the station hides them), episodes and live shows by their title. */
export function PlayedList({ state, now, t }: { state: RadioState; now: number; t: (key: CopyKey) => string }) {
  const rows = playedRows(state, now, t);
  if (!rows.length) {
    return (
      <Rise className="panel mt-10 p-8 md:p-10">
        <p className="editorial text-2xl italic leading-snug md:text-3xl">{state.on_air ? t("radio.empty") : t("radio.offAirText")}</p>
      </Rise>
    );
  }
  return (
    <div className="radio-program mt-10">
      {rows.map((row) => (
        <div key={row.id} className="radio-row" data-now={row.now || undefined} data-past={!row.now || undefined}>
          <p className="text-[15px] font-semibold tabular-nums text-ink">
            {clock(row.start)}
            <span className="block text-xs font-normal text-muted">{longDuration((row.end - row.start) / 1000)}</span>
          </p>
          <div className="min-w-0">
            <p className="truncate text-[1.05rem] font-semibold tracking-[-0.02em] text-ink">{row.title}</p>
            <p className="truncate text-sm text-muted">{row.note}</p>
          </div>
          <div className="flex items-center gap-2">
            {row.now ? <span className="radio-tag" data-kind="vivo">{t("radio.nowLabel")}</span> : null}
            <span className="radio-tag hidden sm:inline-flex" data-kind={row.kind}>{KIND_LABEL[row.kind]}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * The server's history joined with the queue, so a song that just ended moves into the list
 * without waiting for the next poll; songs hidden by the station merge into one row.
 */
function playedRows(state: RadioState, now: number, t: (key: CopyKey) => string): Row[] {
  const timeline: RadioItem[] = [...(state.recent ?? [])].reverse();
  for (const item of state.queue) if (!timeline.some((other) => other.id === item.id)) timeline.push(item);
  const current = currentItem(state.queue, now);
  const at = current ? timeline.findIndex((item) => item.id === current.id) : -1;
  const sounded = (at >= 0 ? timeline.slice(0, at + 1) : timeline.filter((item) => item.end <= now))
    .filter((item) => item.kind !== "efecto" && (item.kind !== "anuncio" || item.id === current?.id));

  const rows: Row[] = [];
  for (const item of sounded) {
    const row = rowOf(item, item.id === current?.id, state, t);
    const last = rows[rows.length - 1];
    if (last && ((last.continuous && row.continuous) || (last.kind === "vivo" && row.kind === "vivo" && last.title === row.title))) {
      rows[rows.length - 1] = { ...last, end: Math.max(last.end, row.end), now: last.now || row.now };
      continue;
    }
    rows.push(row);
  }
  return rows.slice(-ROWS);
}

function rowOf(item: RadioItem, isNow: boolean, state: RadioState, t: (key: CopyKey) => string): Row {
  const base = { id: item.id, start: item.origin, end: item.end, now: isNow, continuous: false };
  const liveTitle = isNow && state.live.on ? state.live.title || item.block : item.kind === "vivo" && !item.bed ? item.block || item.title : null;
  if (liveTitle !== null) return { ...base, kind: "vivo", title: liveTitle || t("radio.liveTitle"), note: t("radio.episode") };
  if (item.kind === "relleno" || hidesSong(state, item)) return { ...base, kind: "relleno", continuous: true, title: t("radio.continuous"), note: t("radio.continuousNote") };
  if (item.kind === "programa") return { ...base, kind: "programa", title: item.title, note: item.artist || KIND_LABEL.programa };
  return { ...base, kind: item.kind === "vivo" ? "musica" : item.kind, title: item.title, note: item.artist || t("radio.continuousNote") };
}
