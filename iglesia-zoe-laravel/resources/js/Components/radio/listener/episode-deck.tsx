import { EpisodeCover } from "@/Components/radio/episode-cover";
import { HeadphonesIcon, PauseIcon, PlayIcon, SkipIcon, VolumeIcon } from "@/Components/radio/icons";
import type { EpisodePlayer } from "@/Components/radio/listener/use-episode";
import type { CopyKey } from "@/lib/copy";
import { duration, longDate, type RadioEpisode } from "@/lib/radio";

/** Main player while listening to an episode: cover, seek bar, jumps of 15 and 30 seconds, and the way back to the live radio. */
export function EpisodeDeck({
  episode,
  player,
  volume,
  onVolume,
  onLive,
  t,
}: {
  episode: RadioEpisode;
  player: EpisodePlayer;
  volume: number;
  onVolume: (value: number) => void;
  onLive: () => void;
  t: (key: CopyKey) => string;
}) {
  const length = player.length || episode.duration;
  const fill = length ? Math.min(100, (player.time / length) * 100) : 0;

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <span className="radio-chip">
          <HeadphonesIcon className="h-3.5 w-3.5" /> {t("radio.episodeLabel")}
        </span>
        <button type="button" onClick={onLive} className="radio-chip radio-chip-button">
          <span className="radio-status-dot text-[#6be3a4]" /> {t("radio.backToLive")}
        </button>
      </div>

      <div className="mt-6 flex items-center gap-5">
        <EpisodeCover src={episode.cover} title={episode.title} className="h-24 w-24 rounded-2xl shadow-[0_18px_40px_-18px_rgba(0,0,0,0.8)] md:h-28 md:w-28" />
        <div className="min-w-0">
          {episode.program ? <p className="truncate text-xs font-semibold uppercase tracking-[0.2em] text-[#ff8a8e]">{episode.program}</p> : null}
          <p className="mt-1 line-clamp-2 text-[1.45rem] font-semibold leading-tight tracking-[-0.03em] text-white md:text-[1.7rem]">{episode.title}</p>
          <p className="mt-1.5 text-sm text-white/55">{longDate(episode.aired_on)}</p>
        </div>
      </div>

      {episode.description ? <p className="mt-5 line-clamp-3 text-[15px] leading-6 text-white/65">{episode.description}</p> : null}

      <div className="mt-6">
        <input
          type="range"
          min={0}
          max={Math.max(1, length)}
          step={1}
          value={Math.min(player.time, length)}
          onChange={(event) => player.seek(Number(event.target.value))}
          className="radio-seek"
          style={{ "--fill": `${fill}%` } as React.CSSProperties}
          aria-label="Avanzar o retroceder"
        />
        <div className="mt-2 flex justify-between text-xs tabular-nums text-white/50">
          <span>{duration(player.time)}</span>
          <span>-{duration(Math.max(0, length - player.time))}</span>
        </div>
      </div>

      <div className="mt-5 flex items-center gap-3">
        <button type="button" onClick={() => player.skip(-15)} className="radio-skip" aria-label="Retroceder 15 segundos">
          <SkipIcon seconds={15} />
        </button>
        <button type="button" className="radio-play" data-on={player.playing || undefined} onClick={() => player.toggle(episode)} aria-label={player.playing ? t("radio.episodePause") : t("radio.episodePlay")}>
          {player.playing ? <PauseIcon className="h-7 w-7" /> : <PlayIcon className="ml-1 h-7 w-7" />}
        </button>
        <button type="button" onClick={() => player.skip(30)} className="radio-skip" aria-label="Adelantar 30 segundos">
          <SkipIcon seconds={30} forward />
        </button>
        <label className="ml-2 flex min-w-0 flex-1 items-center gap-3 text-white/60">
          <VolumeIcon className="h-4 w-4 shrink-0" />
          <span className="sr-only">{t("radio.volume")}</span>
          <input type="range" min={0} max={1} step={0.01} value={volume} onChange={(event) => onVolume(Number(event.target.value))} className="radio-volume" />
        </label>
      </div>

      {player.blocked ? <p className="mt-4 rounded-xl bg-white/10 px-4 py-3 text-sm text-white/80">Toca «{t("radio.episodePlay")}» otra vez para activar el sonido.</p> : null}
    </>
  );
}
