import { IconPlay } from "@/Components/site/icons";
import type { SermonSummary } from "@/lib/types";
import { formatSermonDate, formatViews, timeAgo, videoClock, videoThumbnail, youtubeId } from "@/lib/youtube";

export const CHANNEL_FALLBACK = "Iglesia Cristiana Zoe";

/** Falls back to YouTube's always-present thumbnail when the large one is missing. */
export function VideoThumb({ sermon, eager = false }: { sermon: SermonSummary; eager?: boolean }) {
  const video = youtubeId(sermon.youtube_id);
  return (
    <img
      src={videoThumbnail(sermon)}
      alt=""
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      onError={(event) => {
        const fallback = `https://i.ytimg.com/vi/${video}/hqdefault.jpg`;
        if (video && event.currentTarget.src !== fallback) event.currentTarget.src = fallback;
      }}
    />
  );
}

export function ChannelAvatar({ name }: { name: string }) {
  return (
    <span className="yt-avatar" aria-hidden>
      {(name.replace(/^iglesia\s+cristiana\s+/i, "").trim()[0] || "Z").toUpperCase()}
    </span>
  );
}

/** "353 visualizaciones · hace 6 días", or the service date when YouTube has not been read yet. */
export function videoMeta(sermon: SermonSummary) {
  const when = sermon.aired_at || sermon.sermon_date;
  const parts = [formatViews(sermon.views), sermon.views != null ? timeAgo(when) : formatSermonDate(sermon.sermon_date)];
  return parts.filter(Boolean).join(" · ");
}

/** A sermon presented like a video on the channel: thumbnail with its length, title, channel and views. */
export function VideoCard({
  sermon,
  onPlay,
  tone = "light",
  compact = false,
}: {
  sermon: SermonSummary;
  onPlay: () => void;
  tone?: "light" | "dark";
  compact?: boolean;
}) {
  const clock = videoClock(sermon.duration);
  const channel = sermon.channel || CHANNEL_FALLBACK;
  return (
    <article className="yt-card" data-tone={tone} data-compact={compact || undefined}>
      <button type="button" className="yt-card-thumb" onClick={onPlay} aria-label={`Reproducir: ${sermon.title}`}>
        <VideoThumb sermon={sermon} />
        <span className="yt-card-play" aria-hidden>
          <IconPlay className="h-5 w-5" />
        </span>
        {clock ? <span className="yt-card-time">{clock}</span> : null}
      </button>
      <div className="yt-card-body">
        {compact ? null : <ChannelAvatar name={channel} />}
        <div className="min-w-0">
          <h3 className="yt-card-title">
            <button type="button" onClick={onPlay}>
              {sermon.title}
            </button>
          </h3>
          <p className="yt-card-channel">{channel}</p>
          <p className="yt-card-meta">{videoMeta(sermon)}</p>
        </div>
      </div>
    </article>
  );
}
