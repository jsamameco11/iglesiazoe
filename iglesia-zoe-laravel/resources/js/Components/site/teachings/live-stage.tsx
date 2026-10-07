import { useEffect, useState } from "react";
import { IconPlay } from "@/Components/site/icons";
import type { CopyKey } from "@/lib/copy";
import { formatDuration, type LiveState } from "@/lib/live";
import type { Teaching } from "@/lib/types";
import { formatSermonDate } from "@/lib/youtube";

type T = (key: CopyKey) => string;

const EMBED_ALLOW = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";

/** Seconds since the broadcast started, refreshed every 30 s. */
function useElapsed(startedAt: string | null | undefined) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(id);
  }, []);
  if (!startedAt) return 0;
  return Math.max(60, Math.floor((now - new Date(startedAt).getTime()) / 1000));
}

function ShareButton({ title, url, t }: { title: string; url: string; t: T }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const link = new URL(url, window.location.origin).toString();
    if (navigator.share) {
      try {
        await navigator.share({ title, url: link });
        return;
      } catch {
        // The visitor closed the share sheet; fall back to copying.
      }
    }
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      window.prompt(t("teachings.share"), link);
    }
  }

  return (
    <button type="button" onClick={share} className="stage-btn" data-ghost>
      {copied ? `${t("teachings.copied")} ✓` : t("teachings.share")}
    </button>
  );
}

function Description({ text, t }: { text: string; t: T }) {
  const [open, setOpen] = useState(false);
  const long = text.length > 280;
  return (
    <div className="mt-4">
      <p className={`whitespace-pre-line text-[0.95rem] font-light leading-7 text-white/75 ${long && !open ? "line-clamp-5" : ""}`}>{text}</p>
      {long ? (
        <button type="button" onClick={() => setOpen((value) => !value)} className="mt-2 text-[13px] font-semibold text-white underline-offset-4 hover:underline">
          {open ? t("teachings.readLess") : t("teachings.readMore")}
        </button>
      ) : null}
    </div>
  );
}

function Preacher({ name, t }: { name: string | null | undefined; t: T }) {
  if (!name) return null;
  return (
    <p className="mt-3 text-[14px] text-white/70">
      {t("teachings.preacher")}: <span className="font-medium text-white">{name}</span>
    </p>
  );
}

/** Recorded video that loads only when the visitor presses play. */
function StageVideo({ teaching }: { teaching: Teaching }) {
  const [playing, setPlaying] = useState(false);
  useEffect(() => setPlaying(false), [teaching.id]);

  const poster = teaching.cover || (teaching.youtube_id ? `https://i.ytimg.com/vi/${teaching.youtube_id}/maxresdefault.jpg` : null);

  if (teaching.youtube_id && playing) {
    return (
      <div className="video-frame">
        <iframe src={`https://www.youtube-nocookie.com/embed/${teaching.youtube_id}?autoplay=1&rel=0`} title={teaching.title} allow={EMBED_ALLOW} allowFullScreen />
      </div>
    );
  }

  if (teaching.youtube_id) {
    return (
      <div className="video-frame">
        <button type="button" className="absolute inset-0 block h-full w-full" onClick={() => setPlaying(true)} aria-label={`Reproducir: ${teaching.title}`}>
          {poster ? (
            <img
              src={poster}
              alt=""
              onError={(event) => {
                const fallback = `https://i.ytimg.com/vi/${teaching.youtube_id}/hqdefault.jpg`;
                if (event.currentTarget.src !== fallback) event.currentTarget.src = fallback;
              }}
            />
          ) : null}
          <span className="video-play">
            <span>
              <IconPlay className="h-7 w-7" />
            </span>
          </span>
          {teaching.duration ? <span className="teach-duration">{formatDuration(teaching.duration)}</span> : null}
        </button>
      </div>
    );
  }

  return (
    <div className="video-frame stage-poster">
      {teaching.cover ? <img src={teaching.cover} alt="" /> : null}
      <span className="file-badge stage-file">{teaching.file_type || "PDF"}</span>
    </div>
  );
}

function OnAir({ state, t }: { state: LiveState; t: T }) {
  const elapsed = useElapsed(state.started_at);
  const title = state.title || "";
  const waiting = state.signal === false;

  return (
    <div className="teach-stage-grid">
      <div className="video-frame">
        {state.youtube_id ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${state.youtube_id}?autoplay=1&mute=1&playsinline=1&rel=0`}
            title={title}
            allow={EMBED_ALLOW}
            allowFullScreen
          />
        ) : state.player ? (
          <iframe src={state.player} title={title} allow="autoplay; fullscreen; picture-in-picture" allowFullScreen />
        ) : null}
        {waiting ? (
          <div className="stage-waiting" role="status">
            {state.cover ? <img src={state.cover} alt="" /> : null}
            <p>
              <span className="stage-spinner" aria-hidden />
              {t("teachings.liveWaiting")}
            </p>
          </div>
        ) : null}
      </div>

      <div className="teach-stage-meta">
        <div className="flex flex-wrap items-center gap-3">
          <span className="live-badge">
            <i aria-hidden />
            {t("teachings.liveBadge")}
          </span>
          {state.started_at ? (
            <span className="text-[12px] uppercase tracking-[0.16em] text-white/55">
              {t("teachings.liveSince")} {formatDuration(elapsed)}
            </span>
          ) : null}
        </div>
        <h2 className="editorial mt-5 text-[2rem] leading-[1.08] text-white md:text-[2.6rem]">{title}</h2>
        <Preacher name={state.preacher} t={t} />
        {state.description ? <Description text={state.description} t={t} /> : null}
        <div className="mt-7 flex flex-wrap gap-2">
          {state.youtube_id ? (
            <a href={`https://www.youtube.com/watch?v=${state.youtube_id}`} target="_blank" rel="noreferrer" className="stage-btn">
              {t("teachings.openYoutube")} ↗
            </a>
          ) : null}
          <ShareButton title={title} url="/en-vivo" t={t} />
        </div>
      </div>
    </div>
  );
}

function Featured({ teaching, t }: { teaching: Teaching; t: T }) {
  return (
    <div className="teach-stage-grid">
      <StageVideo teaching={teaching} />

      <div className="teach-stage-meta">
        <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-white/55">
          {teaching.from_live ? t("teachings.latestLive") : t("teachings.latest")}
          <span className="mx-2 text-white/30">·</span>
          {formatSermonDate(teaching.teaching_date)}
        </p>
        <h2 className="editorial mt-4 text-[2rem] leading-[1.08] text-white md:text-[2.6rem]">{teaching.title}</h2>
        <Preacher name={teaching.preacher} t={t} />
        {teaching.summary ? <Description text={teaching.summary} t={t} /> : null}
        <div className="mt-7 flex flex-wrap gap-2">
          {teaching.youtube_id ? (
            <a href={`https://www.youtube.com/watch?v=${teaching.youtube_id}`} target="_blank" rel="noreferrer" className="stage-btn">
              {t("teachings.openYoutube")} ↗
            </a>
          ) : null}
          {teaching.file_url ? (
            <a href={teaching.file_url} target="_blank" rel="noreferrer" className="stage-btn" data-ghost={teaching.youtube_id ? true : undefined}>
              {t("teachings.download")} ↓
            </a>
          ) : null}
          <ShareButton title={teaching.title} url={`/recursos#ensenanza-${teaching.id}`} t={t} />
        </div>
      </div>
    </div>
  );
}

/** The big screen of Enseñanzas: the live broadcast while on air, otherwise the latest teaching. */
export function LiveStage({ state, latest, t }: { state: LiveState; latest: Teaching | null; t: T }) {
  if (state.live) return <OnAir state={state} t={t} />;
  if (latest) return <Featured teaching={latest} t={t} />;

  return (
    <div className="px-2 py-10 text-center md:py-16">
      <span className="live-badge" data-idle>
        <i aria-hidden />
        {t("teachings.liveBadge")}
      </span>
      <p className="editorial mx-auto mt-6 max-w-2xl text-2xl italic leading-snug text-white md:text-3xl">{t("teachings.stageEmpty")}</p>
    </div>
  );
}
