import { Rise } from "@/Components/motion/rise";
import type { CopyKey } from "@/lib/copy";
import { KIND_LABEL, clock, longDuration, type RadioItem } from "@/lib/radio";

/** Gaps filled by a Spotify playlist come titled «Spotify · name». */
const SPOTIFY_PREFIX = "Spotify · ";

export function ProgramList({ items, now, t }: { items: RadioItem[]; now: number; t: (key: CopyKey) => string }) {
  if (!items.length) {
    return (
      <Rise className="panel mt-10 p-8 md:p-10">
        <p className="editorial text-2xl italic leading-snug md:text-3xl">{t("radio.empty")}</p>
      </Rise>
    );
  }
  return (
    <div className="radio-program mt-10">
      {items.map((entry) => {
        const isNow = entry.start <= now && now < entry.end;
        const past = entry.end <= now;
        const spotify = entry.kind === "relleno" && entry.title.startsWith(SPOTIFY_PREFIX) ? entry.title.slice(SPOTIFY_PREFIX.length) : null;
        const filler = entry.kind === "relleno" && !spotify;
        return (
          <div key={entry.id} className="radio-row" data-now={isNow || undefined} data-past={past || undefined}>
            <p className="text-[15px] font-semibold tabular-nums text-ink">
              {clock(entry.start)}
              <span className="block text-xs font-normal text-muted">{longDuration((entry.end - entry.start) / 1000)}</span>
            </p>
            <div className="min-w-0">
              <p className="truncate text-[1.05rem] font-semibold tracking-[-0.02em] text-ink">{spotify ?? (filler ? t("radio.continuous") : entry.title)}</p>
              <p className="truncate text-sm text-muted">{spotify ? "Playlist de Spotify" : filler ? t("radio.continuousNote") : entry.artist || KIND_LABEL[entry.kind]}</p>
            </div>
            <div className="flex items-center gap-2">
              {isNow ? <span className="radio-tag" data-kind="vivo">{t("radio.nowLabel")}</span> : null}
              <span className="radio-tag hidden sm:inline-flex" data-kind={entry.kind}>{KIND_LABEL[entry.kind]}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
