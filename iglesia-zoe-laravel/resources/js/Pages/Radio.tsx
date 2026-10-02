import { Link } from "@inertiajs/react";
import { useState } from "react";
import { Rise } from "@/Components/motion/rise";
import { HeadphonesIcon, MicIcon, PlayIcon, StopIcon, UsersIcon, VolumeIcon } from "@/Components/radio/icons";
import { Visualizer } from "@/Components/radio/meters";
import { ProgramList } from "@/Components/radio/listener/program-list";
import { useStation } from "@/Components/radio/listener/use-station";
import SiteLayout from "@/Layouts/SiteLayout";
import { readCopy, type CopyKey } from "@/lib/copy";
import { section } from "@/lib/design";
import { resolveMedia, type MediaAsset } from "@/lib/media";
import { KIND_LABEL, clock, currentItem, dayLabel, duration, limaDate, type RadioItem, type RadioState } from "@/lib/radio";
import type { SiteSettings } from "@/lib/types";
import "../../css/radio.css";

type ProgramDay = { date: string; items: RadioItem[] };

export default function Radio({
  radio,
  program,
  settings,
  mediaOverrides,
}: {
  radio: RadioState;
  program: ProgramDay[];
  settings: SiteSettings;
  mediaOverrides: Record<string, MediaAsset>;
}) {
  const t = (key: CopyKey) => readCopy(settings, key);
  const media = resolveMedia(mediaOverrides);
  const station = useStation(radio);
  const { state, now, playing, volume, voice, blocked } = station;
  const item = currentItem(state.queue, now);
  const upcoming = state.queue.filter((entry) => entry.start > now).slice(0, 3);
  const live = state.live.on;
  const tone = !state.on_air ? "off" : live ? "live" : "air";
  const [day, setDay] = useState(0);
  const today = program[0]?.date;

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
              <div className="flex items-center justify-between gap-3">
                <span className="radio-chip">
                  <HeadphonesIcon className="h-3.5 w-3.5" /> {t("radio.nowPlaying")}
                </span>
                {item ? <span className="radio-chip">{item.block && item.bed ? KIND_LABEL.vivo : KIND_LABEL[item.kind]}</span> : null}
              </div>

              <div className="mt-6 min-h-[5.5rem]">
                {item ? (
                  <>
                    {item.block ? <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#ff8a8e]">{item.block}</p> : null}
                    <p className="mt-1 text-[1.65rem] font-semibold leading-tight tracking-[-0.03em] text-white md:text-3xl">{item.title}</p>
                    <p className="mt-1.5 text-[15px] text-white/60">{item.artist || (item.kind === "musica" ? t("radio.continuousNote") : KIND_LABEL[item.kind])}</p>
                  </>
                ) : (
                  <>
                    <p className="text-[1.65rem] font-semibold leading-tight tracking-[-0.03em] text-white md:text-3xl">{state.on_air ? (live ? state.live.host : t("radio.paused")) : t("radio.offAir")}</p>
                    {state.next_show ? (
                      <p className="mt-1.5 text-[15px] text-white/60">
                        {state.next_show.title} · {dayLabel(limaDate(state.next_show.start), today)} {clock(state.next_show.start)}
                      </p>
                    ) : null}
                  </>
                )}
              </div>

              <Visualizer analyser={station.analyser} active={playing} className="radio-viz" />

              {item ? (
                <div className="mt-4">
                  <div className="radio-progress">
                    <span style={{ width: `${Math.min(100, Math.max(0, ((now - item.origin) / Math.max(1, item.end - item.origin)) * 100))}%` }} />
                  </div>
                  <div className="mt-2 flex justify-between text-xs tabular-nums text-white/50">
                    <span>{duration((now - item.origin) / 1000)}</span>
                    <span>-{duration((item.end - now) / 1000)}</span>
                  </div>
                </div>
              ) : null}

              <div className="mt-6 flex items-center gap-5">
                <button
                  type="button"
                  className="radio-play"
                  data-on={playing || undefined}
                  disabled={!state.on_air}
                  onClick={station.toggle}
                  aria-label={playing ? t("radio.stop") : t("radio.listen")}
                >
                  {playing ? <StopIcon /> : <PlayIcon className="ml-1 h-7 w-7" />}
                </button>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-white">{playing ? t("radio.stop") : t("radio.listen")}</p>
                  <label className="mt-2 flex items-center gap-3 text-white/60">
                    <VolumeIcon className="h-4 w-4 shrink-0" />
                    <span className="sr-only">{t("radio.volume")}</span>
                    <input type="range" min={0} max={1} step={0.01} value={volume} onChange={(event) => station.setVolume(Number(event.target.value))} className="radio-volume" />
                  </label>
                </div>
              </div>

              {blocked ? <p className="mt-4 rounded-xl bg-white/10 px-4 py-3 text-sm text-white/80">Toca «{t("radio.listen")}» otra vez para activar el sonido.</p> : null}

              {live ? (
                <div className="radio-host">
                  <span className="radio-mic" data-talking={state.live.mic || undefined}>
                    <MicIcon />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#ff8a8e]">{t("radio.host")}</p>
                    <p className="truncate text-[15px] font-semibold text-white">
                      {state.live.host}
                      {state.live.mic ? <span className="font-normal text-white/60"> · {t("radio.talking")}</span> : null}
                    </p>
                    {playing && voice === "connecting" ? <p className="text-xs text-white/50">Conectando con la cabina…</p> : null}
                  </div>
                </div>
              ) : null}

              <p className="mt-5 text-xs leading-5 text-white/40">{t("radio.tip")}</p>
            </div>
          </Rise>
        </div>
      </section>

      <div className="page-wrap">
        {upcoming.length ? (
          <section {...section("next", "Lo que viene")}>
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

        <section {...section("program", "Programación")} className={upcoming.length ? "mt-24" : ""}>
          <Rise className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="kicker">{t("radio.programKicker")}</p>
              <h2 className="editorial mt-4 text-4xl leading-[1.05] md:text-5xl">{t("radio.programTitle")}</h2>
            </div>
            <div className="flex rounded-full border border-line bg-card p-1">
              {program.map((entry, index) => (
                <button
                  key={entry.date}
                  type="button"
                  onClick={() => setDay(index)}
                  className={`rounded-full px-5 py-2 text-sm font-semibold capitalize transition ${day === index ? "bg-ink text-white" : "text-muted hover:text-ink"}`}
                >
                  {dayLabel(entry.date, today)}
                </button>
              ))}
            </div>
          </Rise>
          <ProgramList items={program[day]?.items ?? []} now={now} t={t} />
        </section>

        <Rise className="ink-band mt-24 rounded-[2rem] px-8 py-14 md:px-14">
          <div className="flex flex-wrap items-end justify-between gap-8">
            <div className="max-w-xl">
              <h2 className="editorial text-4xl leading-[1.05] text-white md:text-5xl">{t("radio.prayerTitle")}</h2>
              <p className="mt-4 text-[15px] leading-7 text-white/70">{t("radio.prayerText")}</p>
            </div>
            <Link href="/contacto" className="btn-accent rounded-full px-6 py-3 text-sm font-semibold">{t("radio.prayerCta")} →</Link>
          </div>
        </Rise>
      </div>
    </SiteLayout>
  );
}
