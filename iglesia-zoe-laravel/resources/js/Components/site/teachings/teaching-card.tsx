import { useState } from "react";
import { IconPlay } from "@/Components/site/icons";
import type { CopyKey } from "@/lib/copy";
import { formatDuration } from "@/lib/live";
import type { Teaching } from "@/lib/types";
import { formatSermonDate } from "@/lib/youtube";

/** Thumbnail that turns into the YouTube player in place. */
function Thumb({ item }: { item: Teaching }) {
  const [playing, setPlaying] = useState(false);
  if (!item.youtube_id) return null;

  return (
    <div className="teach-thumb">
      {playing ? (
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${item.youtube_id}?autoplay=1&rel=0`}
          title={item.title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      ) : (
        <button type="button" className="absolute inset-0 block h-full w-full" onClick={() => setPlaying(true)} aria-label={`Reproducir: ${item.title}`}>
          <img src={item.cover || `https://i.ytimg.com/vi/${item.youtube_id}/hqdefault.jpg`} alt="" loading="lazy" />
          <span className="teach-thumb-play" aria-hidden>
            <IconPlay className="h-5 w-5" />
          </span>
          {item.duration ? <span className="teach-duration">{formatDuration(item.duration)}</span> : null}
        </button>
      )}
    </div>
  );
}

export function TeachingCard({ item, t }: { item: Teaching; t: (key: CopyKey) => string }) {
  return (
    <article id={`ensenanza-${item.id}`} className="teaching-card lift" data-video={item.youtube_id ? true : undefined}>
      {item.youtube_id ? (
        <Thumb item={item} />
      ) : (
        <div className="flex items-start justify-between gap-4">
          <span className="file-badge">{item.file_type || "PDF"}</span>
          <span className="teaching-tag">{item.kind === "gc" ? t("teachings.kindGroups") : t("teachings.kindSermon")}</span>
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2">
        {item.youtube_id ? <span className="teaching-tag">{item.kind === "gc" ? t("teachings.kindGroups") : t("teachings.kindSermon")}</span> : null}
        <p className="text-[11px] uppercase tracking-[0.18em] text-muted">{formatSermonDate(item.teaching_date)}</p>
        {item.from_live ? <span className="teach-live-mark">● {t("teachings.fromLive")}</span> : null}
      </div>
      <h3 className="mt-3 text-[1.25rem] font-medium leading-snug tracking-[-0.02em] text-ink">{item.title}</h3>
      {item.preacher ? (
        <p className="mt-1.5 text-[13.5px] text-muted">
          {t("teachings.preacher")}: <span className="text-ink">{item.preacher}</span>
        </p>
      ) : null}
      {item.summary ? <p className="mt-3 line-clamp-3 text-[0.93rem] font-light leading-7">{item.summary}</p> : null}

      {item.file_url || item.youtube_id ? (
        <div className="mt-auto flex flex-wrap gap-2 pt-6">
          {item.file_url ? (
            <a href={item.file_url} target="_blank" rel="noreferrer" className="btn-accent rounded-full px-4 py-2 text-[13px] font-semibold">
              {t("teachings.download")} ↓
            </a>
          ) : null}
          {item.youtube_id ? (
            <a
              href={`https://www.youtube.com/watch?v=${item.youtube_id}`}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-line px-4 py-2 text-[13px] font-semibold text-ink transition hover:border-ink/40"
            >
              {t("teachings.openYoutube")} ↗
            </a>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
