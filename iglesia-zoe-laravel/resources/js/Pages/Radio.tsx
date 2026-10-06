import { Link } from "@inertiajs/react";
import { Rise } from "@/Components/motion/rise";
import { UsersIcon } from "@/Components/radio/icons";
import { EpisodeDeck } from "@/Components/radio/listener/episode-deck";
import { EpisodeList } from "@/Components/radio/listener/episode-list";
import { LiveDeck } from "@/Components/radio/listener/live-deck";
import { PlayedList } from "@/Components/radio/listener/played-list";
import { useEpisode } from "@/Components/radio/listener/use-episode";
import { useStation } from "@/Components/radio/listener/use-station";
import SiteLayout from "@/Layouts/SiteLayout";
import { readCopy, type CopyKey } from "@/lib/copy";
import { section, useArt } from "@/lib/design";
import { resolveMedia, type MediaAsset } from "@/lib/media";
import { KIND_LABEL, clock, type RadioEpisode, type RadioState } from "@/lib/radio";
import type { SiteSettings } from "@/lib/types";
import "../../css/radio.css";

export default function Radio({
  radio,
  today,
  episodes,
  settings,
  mediaOverrides,
}: {
  radio: RadioState;
  today: string;
  episodes: RadioEpisode[];
  settings: SiteSettings;
  mediaOverrides: Record<string, MediaAsset>;
}) {
  const t = (key: CopyKey) => readCopy(settings, key);
  const media = resolveMedia(mediaOverrides);
  const station = useStation(radio);
  const player = useEpisode(station.volume);
  const bars = useArt("radio");
  const { state, now } = station;
  const upcoming = state.queue.filter((entry) => entry.start > now).slice(0, 3);
  const tone = !state.on_air ? "off" : state.live.on ? "live" : "air";
  /** The live radio and an episode never sound together: starting one stops the other. */
  function playEpisode(episode: RadioEpisode) {
    if (station.playing) void station.toggle();
    if (player.episode?.id !== episode.id) document.querySelector('[data-section="hero"]')?.scrollIntoView({ behavior: "smooth", block: "start" });
    player.toggle(episode);
  }

  function backToLive() {
    player.close();
    if (!station.playing && state.on_air) void station.toggle();
  }

  return (
    <SiteLayout overMedia="page">
      <section {...section("hero", "Reproductor en vivo")} className="radio-hero">
        {media.radio.src ? <div className="radio-hero-backdrop" style={{ backgroundImage: `url(${media.radio.src})` }} /> : null}
        <div className="section-wrap radio-hero-grid">
          <Rise>
            <p className="radio-kicker">{t("radio.kicker")}</p>
            <h1 className="editorial mt-5 text-6xl leading-[0.95] text-white md:text-8xl">{state.name}</h1>
            {state.tagline ? <p className="mt-6 max-w-lg text-lg font-light leading-8 text-white/70">{state.tagline}</p> : null}
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <span className="radio-status" data-tone={tone}>
                <span className="radio-status-dot" />
                {tone === "off" ? t("radio.offAir") : tone === "live" ? t("radio.live") : t("radio.onAir")}
              </span>
              {state.on_air ? (
                <span className="inline-flex items-center gap-2 text-sm text-white/60">
                  <UsersIcon /> {state.listeners} {t("radio.listeners")}
                </span>
              ) : null}
            </div>
            {!state.on_air ? <p className="mt-6 max-w-md text-[15px] leading-7 text-white/60">{t("radio.offAirText")}</p> : null}
          </Rise>

          <Rise delay={0.08}>
            <div className="radio-deck" data-art="radio">
              {player.episode ? (
                <EpisodeDeck episode={player.episode} player={player} volume={station.volume} onVolume={station.setVolume} onLive={backToLive} t={t} />
              ) : (
                <LiveDeck station={station} today={today} bars={bars} t={t} />
              )}
            </div>
          </Rise>
        </div>
      </section>

      <div className="page-wrap">
        <EpisodeList episodes={episodes} current={player.episode?.id ?? null} playing={player.playing} onPlay={playEpisode} t={t} />

        <section {...section("program", "Programación")} className="mt-24">
          <Rise>
            <p className="kicker">{t("radio.programKicker")}</p>
            <h2 className="editorial mt-4 text-4xl leading-[1.05] md:text-5xl">{t("radio.programTitle")}</h2>
          </Rise>
          <PlayedList state={state} now={now} t={t} />
        </section>

        {upcoming.length ? (
          <section {...section("next", "Lo que viene")} className="mt-24">
            <Rise>
              <p className="kicker">{t("radio.nextTitle")}</p>
            </Rise>
            <div className="radio-next mt-6">
              {upcoming.map((entry) => (
                <Rise key={entry.id} className="radio-next-card">
                  <p className="text-sm font-semibold tabular-nums text-muted">{clock(entry.start)}</p>
                  <p className="mt-2 text-lg font-semibold leading-snug tracking-[-0.02em] text-ink">{entry.title}</p>
                  <p className="mt-1 text-sm text-muted">{entry.block ?? entry.artist ?? KIND_LABEL[entry.kind]}</p>
                </Rise>
              ))}
            </div>
          </section>
        ) : null}

        <Rise className="ink-band mt-24 rounded-[2rem] px-8 py-14 md:px-14">
          <div className="flex flex-wrap items-end justify-between gap-8">
            <div className="max-w-xl">
              <h2 className="editorial text-4xl leading-[1.05] text-white md:text-5xl">{t("radio.prayerTitle")}</h2>
              <p className="mt-4 text-[15px] leading-7 text-white/70">{t("radio.prayerText")}</p>
            </div>
            <Link href="/contacto?al-aire=1#peticion" className="btn-accent rounded-full px-6 py-3 text-sm font-semibold">{t("radio.prayerCta")} →</Link>
          </div>
        </Rise>
      </div>
    </SiteLayout>
  );
}
