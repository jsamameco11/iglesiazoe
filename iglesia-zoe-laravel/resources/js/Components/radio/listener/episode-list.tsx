import { useState } from "react";
import { Rise } from "@/Components/motion/rise";
import { EpisodeCover } from "@/Components/radio/episode-cover";
import { PauseIcon, PlayIcon } from "@/Components/radio/icons";
import type { CopyKey } from "@/lib/copy";
import { section } from "@/lib/design";
import { duration, longDate, type RadioEpisode } from "@/lib/radio";

/** Episodes of /radio: cover, title, short description and Play; the chosen one plays in the main player above. */
export function EpisodeList({
  episodes,
  current,
  playing,
  onPlay,
  t,
}: {
  episodes: RadioEpisode[];
  current: string | null;
  playing: boolean;
  onPlay: (episode: RadioEpisode) => void;
  t: (key: CopyKey) => string;
}) {
  const programs = [...new Set(episodes.map((episode) => episode.program).filter((name): name is string => Boolean(name)))];
  const [program, setProgram] = useState<string | null>(null);
  const shown = program ? episodes.filter((episode) => episode.program === program) : episodes;

  return (
    <section {...section("episodes", "Episodios")}>
      <Rise className="flex flex-wrap items-end justify-between gap-6">
        <div className="max-w-xl">
          <p className="kicker">{t("radio.episodesKicker")}</p>
          <h2 className="editorial mt-4 text-4xl leading-[1.05] md:text-5xl">{t("radio.episodesTitle")}</h2>
          <p className="mt-4 text-[15px] leading-7 text-muted">{t("radio.episodesText")}</p>
        </div>
        {programs.length > 1 ? (
          <div className="flex max-w-full gap-1 overflow-x-auto rounded-full border border-line bg-card p-1 [scrollbar-width:none]">
            {[null, ...programs].map((name) => (
              <button
                key={name ?? "all"}
                type="button"
                onClick={() => setProgram(name)}
                className={`shrink-0 rounded-full px-5 py-2 text-sm font-semibold transition ${program === name ? "bg-ink text-white" : "text-muted hover:text-ink"}`}
              >
                {name ?? t("radio.episodesAll")}
              </button>
            ))}
          </div>
        ) : null}
      </Rise>

      {shown.length === 0 ? (
        <Rise className="panel mt-10 p-8 md:p-10">
          <p className="editorial text-2xl italic leading-snug md:text-3xl">{t("radio.episodesEmpty")}</p>
        </Rise>
      ) : (
        <div className="episode-list mt-10">
          {shown.map((episode) => {
            const isCurrent = current === episode.id;
            const on = isCurrent && playing;
            return (
              <Rise key={episode.id} className="episode-row" data-current={isCurrent ? "" : undefined}>
                <EpisodeCover src={episode.cover} title={episode.title} className="aspect-square w-full rounded-2xl" />
                <div className="min-w-0">
                  <p className="text-[12.5px] font-medium text-muted">
                    {episode.program ? <span className="font-semibold text-ink/80">{episode.program} · </span> : null}
                    {longDate(episode.aired_on)} · {duration(episode.duration)}
                  </p>
                  <h3 className="mt-1 text-[1.1rem] font-semibold leading-snug tracking-[-0.02em] text-ink md:text-xl">{episode.title}</h3>
                  {episode.description ? <p className="mt-1.5 line-clamp-2 max-w-2xl text-[14.5px] leading-6 text-muted">{episode.description}</p> : null}
                </div>
                <button type="button" className="episode-play" data-on={on || undefined} onClick={() => onPlay(episode)} aria-label={`${on ? t("radio.episodePause") : t("radio.episodePlay")}: ${episode.title}`}>
                  {on ? <PauseIcon className="h-5 w-5" /> : <PlayIcon className="ml-0.5 h-5 w-5" />}
                </button>
              </Rise>
            );
          })}
        </div>
      )}
    </section>
  );
}
