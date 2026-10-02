import { Link } from "@inertiajs/react";
import { useEffect, useRef, useState } from "react";
import { Rise } from "@/Components/motion/rise";
import { HeadphonesIcon, MicIcon, PlayIcon, UsersIcon } from "@/Components/radio/icons";
import { readCopy, type CopyKey } from "@/lib/copy";
import type { MediaAsset } from "@/lib/media";
import { KIND_LABEL, ServerClock, clock, currentItem, dayLabel, limaDate, type RadioState } from "@/lib/radio";
import type { SiteSettings } from "@/lib/types";
import "../../../../css/radio.css";

/** Station snapshot for the home page: refreshed every 30 s while the tab is visible, without joining as a listener. */
function useRadioSnapshot(initial: RadioState) {
  const clockRef = useRef<ServerClock | null>(null);
  clockRef.current ??= new ServerClock();
  const serverClock = clockRef.current;
  const [state, setState] = useState(initial);
  const [now, setNow] = useState(initial.now);

  useEffect(() => {
    serverClock.seed(initial.now);
    setNow(serverClock.now());
    const tick = window.setInterval(() => setNow(serverClock.now()), 5000);
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

export function RadioSection({ settings, radio, asset }: { settings: SiteSettings; radio: RadioState; asset: MediaAsset }) {
  const t = (key: CopyKey) => readCopy(settings, key);
  const { state, now } = useRadioSnapshot(radio);
  const item = state.on_air ? currentItem(state.queue, now) : null;
  const live = state.live.on;
  const tone = !state.on_air ? "off" : live ? "live" : "air";

  return (
    <section className="home-section">
      <Rise>
        <div className="home-radio">
          {asset.src ? <div className="radio-hero-backdrop" style={{ backgroundImage: `url(${asset.src})` }} /> : null}
          <div className="home-radio-grid">
            <div>
              <p className="radio-kicker">{t("radio.kicker")}</p>
              <h2 className="editorial mt-4 text-5xl leading-[0.95] text-white md:text-7xl">{state.name}</h2>
              {state.tagline ? <p className="mt-5 max-w-md text-base font-light leading-7 text-white/70 md:text-lg">{state.tagline}</p> : null}
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <span className="radio-status" data-tone={tone}>
                  <span className="radio-status-dot" />
                  {tone === "off" ? t("radio.offAir") : tone === "live" ? t("radio.live") : t("radio.onAir")}
                </span>
                {state.on_air && state.listeners > 0 ? (
                  <span className="inline-flex items-center gap-2 text-sm text-white/60">
                    <UsersIcon /> {state.listeners} {t("radio.listeners")}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="radio-deck">
              <span className="radio-chip">
                <HeadphonesIcon className="h-3.5 w-3.5" /> {t("radio.nowPlaying")}
              </span>
              <div className="mt-5 min-h-[4.5rem]">
                {item ? (
                  <>
                    {item.block ? <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#ff8a8e]">{item.block}</p> : null}
                    <p className="mt-1 text-2xl font-semibold leading-tight tracking-[-0.03em] text-white md:text-[1.7rem]">{item.title}</p>
                    <p className="mt-1.5 text-[15px] text-white/60">{item.artist || (item.kind === "musica" ? t("radio.continuousNote") : KIND_LABEL[item.kind])}</p>
                  </>
                ) : (
                  <>
                    <p className="text-2xl font-semibold leading-tight tracking-[-0.03em] text-white md:text-[1.7rem]">
                      {state.on_air ? (live ? state.live.host : t("radio.paused")) : t("radio.offAir")}
                    </p>
                    {state.next_show ? (
                      <p className="mt-1.5 text-[15px] text-white/60">
                        {state.next_show.title} · {dayLabel(limaDate(state.next_show.start), limaDate(now))} {clock(state.next_show.start)}
                      </p>
                    ) : null}
                  </>
                )}
              </div>

              {live ? (
                <div className="radio-host">
                  <span className="radio-mic" data-talking={state.live.mic || undefined}>
                    <MicIcon />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#ff8a8e]">{t("radio.host")}</p>
                    <p className="truncate text-[15px] font-semibold text-white">{state.live.host}</p>
                  </div>
                </div>
              ) : null}

              <div className="mt-6 flex flex-wrap items-center justify-between gap-5">
                <Link href="/radio" className="inline-flex items-center gap-4 text-sm font-semibold text-white">
                  <span className="radio-play">
                    <PlayIcon className="ml-0.5 h-6 w-6" />
                  </span>
                  {t("radio.listen")}
                </Link>
                <Link href="/radio" className="home-link text-white">
                  {t("home.radioMore")} →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </Rise>
    </section>
  );
}
