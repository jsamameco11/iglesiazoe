import { Fragment, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChannelAvatar, CHANNEL_FALLBACK, VideoCard } from "@/Components/site/sermons/video-card";
import { useCopy } from "@/lib/copy";
import type { SermonSummary } from "@/lib/types";
import { formatAired, formatSermonDate, formatViews, youtubeId } from "@/lib/youtube";

/** Which video of a list is open in the theater; null while it is closed. */
export function useTheater(list: SermonSummary[]) {
  const playable = list.filter((sermon) => youtubeId(sermon.youtube_id));
  const [openId, setOpenId] = useState<string | null>(null);
  const index = openId ? playable.findIndex((sermon) => sermon.id === openId) : -1;
  return {
    playable,
    index,
    open: (sermon: SermonSummary) => setOpenId(sermon.id),
    show: (next: number) => setOpenId(playable[next]?.id ?? null),
    close: () => setOpenId(null),
  };
}

const LINK = /(https?:\/\/[^\s]+)/g;

/** Description text with its links clickable, the way YouTube shows it. */
function Description({ text }: { text: string }) {
  return (
    <>
      {text.split(LINK).map((part, index) =>
        index % 2 === 1 ? (
          <a key={index} href={part} target="_blank" rel="noreferrer">
            {part}
          </a>
        ) : (
          <Fragment key={index}>{part}</Fragment>
        ),
      )}
    </>
  );
}

/**
 * Full-screen player: the video plays on the site with its title, channel, views, date and
 * description as on YouTube, and the rest of the list on the side to keep watching.
 */
export function VideoTheater({
  list,
  index,
  onIndex,
  onClose,
}: {
  list: SermonSummary[];
  index: number;
  onIndex: (index: number) => void;
  onClose: () => void;
}) {
  const t = useCopy();
  const closeRef = useRef<HTMLButtonElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const sermon = list[index];
  const video = youtubeId(sermon?.youtube_id);
  const count = list.length;
  const go = (step: number) => onIndex((index + step + count) % count);

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus?.();
    };
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (count > 1 && event.key === "ArrowRight") go(1);
      if (count > 1 && event.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  useEffect(() => {
    setExpanded(false);
    setCopied(false);
    bodyRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [index]);

  if (!sermon || !video) return null;

  const channel = sermon.channel || CHANNEL_FALLBACK;
  const watchUrl = `https://www.youtube.com/watch?v=${video}`;
  const aired = formatAired(sermon.aired_at) || formatSermonDate(sermon.sermon_date);
  const stats = [formatViews(sermon.views), aired ? `${sermon.aired_at ? "Transmitido el" : "Publicado el"} ${aired}` : ""].filter(Boolean).join("  ·  ");
  const description = (sermon.description || "").trim();
  const others = Array.from({ length: count - 1 }, (_, step) => (index + 1 + step) % count).map((position) => ({ item: list[position], position }));

  async function share() {
    const url = `${window.location.origin}/predicas?v=${video}`;
    if (navigator.share) {
      await navigator.share({ title: sermon.title, url }).catch(() => undefined);
      return;
    }
    await navigator.clipboard?.writeText(url).catch(() => undefined);
    setCopied(true);
  }

  return createPortal(
    <div className="yt-theater" role="dialog" aria-modal="true" aria-label={sermon.title}>
      <button type="button" className="yt-theater-scrim" aria-label="Cerrar" tabIndex={-1} onClick={onClose} />
      <div className="yt-theater-bar">
        <span className="truncate">{sermon.series || t("sermons.library")}</span>
        <div className="flex shrink-0 items-center gap-2">
          {count > 1 ? (
            <>
              <button type="button" className="lightbox-chip" aria-label="Video anterior" onClick={() => go(-1)}>
                ←
              </button>
              <span className="tabular-nums text-white/60">
                {index + 1} / {count}
              </span>
              <button type="button" className="lightbox-chip" aria-label="Video siguiente" onClick={() => go(1)}>
                →
              </button>
            </>
          ) : null}
          <button ref={closeRef} type="button" className="lightbox-chip" onClick={onClose}>
            Cerrar ✕
          </button>
        </div>
      </div>
      <div ref={bodyRef} className="yt-theater-body">
        <div className="yt-theater-grid">
          <div className="min-w-0">
            <div className="yt-player">
              <iframe
                key={video}
                src={`https://www.youtube-nocookie.com/embed/${video}?autoplay=1&rel=0&modestbranding=1&playsinline=1`}
                title={sermon.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
              />
            </div>
            <h2 className="yt-theater-title">{sermon.title}</h2>
            <div className="yt-owner">
              <div className="flex min-w-0 items-center gap-3">
                <ChannelAvatar name={channel} />
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-semibold">{channel}</p>
                  {sermon.preacher ? <p className="truncate text-[12.5px] text-white/60">{sermon.preacher}</p> : null}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="yt-pill" onClick={share}>
                  {copied ? `${t("sermons.copied")} ✓` : `${t("sermons.share")} ↗`}
                </button>
                <a href={watchUrl} target="_blank" rel="noreferrer" className="yt-pill" data-strong>
                  {t("sermons.openYoutube")}
                </a>
              </div>
            </div>
            <div className="yt-description" data-open={expanded || undefined}>
              {stats ? <p className="font-semibold">{stats}</p> : null}
              {description ? (
                <>
                  <p className="yt-description-text">
                    <Description text={description} />
                  </p>
                  {description.length > 180 || description.split("\n").length > 3 ? (
                    <button type="button" className="mt-2 font-semibold" onClick={() => setExpanded((open) => !open)}>
                      {expanded ? "Mostrar menos" : "…más"}
                    </button>
                  ) : null}
                </>
              ) : null}
            </div>
          </div>
          {others.length ? (
            <aside className="yt-upnext" aria-label={t("sermons.upNext")}>
              <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/50">{t("sermons.upNext")}</p>
              <div className="grid gap-4">
                {others.slice(0, 12).map(({ item, position }) => (
                  <VideoCard key={item.id} sermon={item} tone="dark" compact onPlay={() => onIndex(position)} />
                ))}
              </div>
            </aside>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}
