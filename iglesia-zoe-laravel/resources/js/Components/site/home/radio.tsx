import { Link } from "@inertiajs/react";
import { useEffect, useState } from "react";
import { Rise } from "@/Components/motion/rise";
import { MicIcon, PlayIcon, UsersIcon } from "@/Components/radio/icons";
import { readCopy, type CopyKey } from "@/lib/copy";
import type { MediaAsset } from "@/lib/media";
import { KIND_LABEL, clock, currentItem, dayLabel, hidesSong, limaDate, useServerClock, type RadioState } from "@/lib/radio";
import type { SiteSettings } from "@/lib/types";
import "../../../../css/radio.css";
import { section } from "@/lib/design";

const BARS = 36;

/** Station snapshot for the home page: refreshed every 30 s while the tab is visible, without joining as a listener. */
function useRadioSnapshot(initial: RadioState) {
  const serverClock = useServerClock();
  const [state, setState] = useState(initial);
  const [now, setNow] = useState(initial.now);

  useEffect(() => {
    serverClock.seed(initial.now);
    setNow(serverClock.now());
    const tick = window.setInterval(() => setNow(serverClock.now()), 1000);
    const poll = window.setInterval(async () => {
      if (document.hidden) return;
      const sent = Date.now();
      try {
        const res = await fetch("/radio/estado", { headers: { Accept: "application/json" }, cache: "no-store" });
        if (!res.ok) return;
        const next = (await res.json()) as RadioState;
        serverClock.sample(next.now, sent, Date.now());
        setState(next);
        setNow(serverClock.now());
      } catch {
        /* keep the last snapshot */
      }
    }, 30000);
    return () => {
      window.clearInterval(tick);
      window.clearInterval(poll);
    };
  }, [initial.now, serverClock]);

  return { state, now };
}

/** The frame of RadioSection while its live snapshot loads, right after the page. */
export function RadioSectionSkeleton() {
  return (
    <section {...section("radio", "Radio")} className="home-section" aria-busy>
      <div className="onair" data-tone="off">
        <div className="onair-grid animate-pulse" aria-hidden>
          <div className="space-y-5">
            <div className="h-7 w-44 rounded-full bg-white/10" />
            <div className="h-14 w-3/4 rounded-2xl bg-white/10" />
            <div className="h-4 w-1/2 rounded-full bg-white/[0.07]" />
            <div className="flex gap-3 pt-4">
              <div className="h-12 w-40 rounded-full bg-white/10" />
              <div className="h-12 w-32 rounded-full bg-white/[0.06]" />
            </div>
          </div>
          <div className="h-72 rounded-3xl bg-white/[0.06]" />
        </div>
      </div>
    </section>
  );
}

export function RadioSection({ settings, radio, asset }: { settings: SiteSettings; radio: RadioState; asset: MediaAsset }) {
  const t = (key: CopyKey) => readCopy(settings, key);
  const { state, now } = useRadioSnapshot(radio);
  const item = state.on_air ? currentItem(state.queue, now) : null;
  const upcoming = state.on_air ? state.queue.find((entry) => entry.start > now) ?? null : null;
  const live = state.live.on;
  const tone = !state.on_air ? "off" : live ? "live" : "air";
  const hidden = item ? hidesSong(state, item) : false;

  return (
    <section {...section("radio", "Radio")} className="home-section">
      <Rise>
        <div className="onair" data-tone={tone}>
          {asset.src ? <div className="onair-backdrop" style={{ backgroundImage: `url(${asset.src})` }} aria-hidden /> : null}
          <div className="onair-grid">
            <div className="onair-copy">
              <div className="flex flex-wrap items-center gap-3">
                <span className="onair-badge" data-tone={tone}>
                  <span className="onair-dot" />
                  {tone === "off" ? t("radio.offAir") : tone === "live" ? t("radio.live") : t("radio.onAir")}
                </span>
                <span className="onair-kicker">{t("radio.kicker")}</span>
              </div>
              <h2 className="editorial onair-title text-white">{state.name}</h2>
              {state.tagline ? <p className="onair-tagline">{state.tagline}</p> : null}

              <div className="onair-actions">
                <Link href="/radio" className="onair-listen">
                  <span className="onair-listen-icon">
                    <PlayIcon className="ml-0.5 h-4 w-4" />
                  </span>
                  {t("radio.listen")}
                </Link>
                <Link href="/radio" className="onair-more">
                  {t("home.radioMore")} <span aria-hidden>→</span>
                </Link>
              </div>

              <dl className="onair-facts">
                <div>
                  <dt>{t("radio.nowLabel")}</dt>
                  <dd className="tabular-nums">{clock(now)}</dd>
                </div>
                {state.on_air && state.listeners > 0 ? (
                  <div>
                    <dt>
                      <UsersIcon className="h-3 w-3" />
                    </dt>
                    <dd>
                      {state.listeners} {t("radio.listeners")}
                    </dd>
                  </div>
                ) : null}
                {state.next_show ? (
                  <div className="min-w-0">
                    <dt>{t("radio.nextTitle")}</dt>
                    <dd className="truncate">
                      {state.next_show.title} · {dayLabel(limaDate(state.next_show.start), limaDate(now))} {clock(state.next_show.start)}
                    </dd>
                  </div>
                ) : null}
              </dl>
            </div>

            <div className="onair-player">
              <div className="flex items-center justify-between gap-3">
                <span className="onair-chip">
                  <span className="radio-live-dot" data-on={state.on_air || undefined} aria-hidden /> {t("radio.nowPlaying")}
                </span>
                {item?.block ? <span className="onair-block">{item.block}</span> : null}
              </div>

              <div className="onair-eq" data-on={state.on_air ? "" : undefined} aria-hidden>
                {Array.from({ length: BARS }, (_, index) => (
                  <span key={index} style={{ animationDelay: `${-((index * 137) % 1100)}ms`, animationDuration: `${900 + ((index * 53) % 700)}ms` }} />
                ))}
              </div>

              <div className="min-h-[4.25rem]">
                {item ? (
                  <>
                    <p className="onair-now">{hidden ? t("radio.songHidden") : item.title}</p>
                    <p className="onair-sub">{hidden ? t("radio.continuousNote") : item.artist || (item.kind === "musica" ? t("radio.continuousNote") : KIND_LABEL[item.kind])}</p>
                  </>
                ) : (
                  <>
                    <p className="onair-now">{state.on_air ? (live ? state.live.title || t("radio.liveTitle") : t("radio.paused")) : t("radio.offAir")}</p>
                    <p className="onair-sub">{t("radio.continuousNote")}</p>
                  </>
                )}
              </div>

              {live ? (
                <div className="onair-host">
                  <span className="radio-mic" data-talking={state.live.mic || undefined}>
                    <MicIcon />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-[#ff8a8e]">{t("radio.episode")}</p>
                    <p className="truncate text-[15px] font-semibold text-white">{state.live.title || t("radio.liveTitle")}</p>
                  </div>
                </div>
              ) : null}

              {upcoming ? (
                <div className="onair-up">
                  <span className="onair-up-label">{t("radio.nextTitle")}</span>
                  <span className="min-w-0 flex-1 truncate text-white/80">{hidesSong(state, upcoming) ? t("radio.songHidden") : upcoming.title}</span>
                  <span className="shrink-0 font-mono text-[11px] tabular-nums text-white/45">{clock(upcoming.start)}</span>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </Rise>
    </section>
  );
}
