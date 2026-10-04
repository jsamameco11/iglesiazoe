import { HeadphonesIcon, MicIcon, PlayIcon, SpotifyIcon, StopIcon, VolumeIcon } from "@/Components/radio/icons";
import { Visualizer } from "@/Components/radio/meters";
import { useSpotifyAir } from "@/Components/radio/listener/use-spotify-air";
import type { useStation } from "@/Components/radio/listener/use-station";
import type { CopyKey } from "@/lib/copy";
import { KIND_LABEL, clock, currentItem, dayLabel, duration, limaDate } from "@/lib/radio";

/** What the listener should know about the Spotify player: a change on its way, or how to hear full songs. */
function spotifyNote(spotify: ReturnType<typeof useSpotifyAir>, stationName: string) {
  const waiting = spotify.waiting;
  if (waiting) {
    return waiting.next
      ? `A las ${clock(waiting.since)} la música pasa a Spotify «${waiting.next.name}», al terminar la canción.`
      : `A las ${clock(waiting.since)} vuelve la música de ${stationName}, al terminar la canción de Spotify.`;
  }
  return "Suena en el reproductor de Spotify. Inicia sesión en Spotify (gratis) para escuchar las canciones completas; sin sesión se oyen adelantos de 30 segundos.";
}

/** Main player while listening to the live radio: what is on now, its progress, the host and the volume. */
export function LiveDeck({
  station,
  today,
  bars,
  t,
}: {
  station: ReturnType<typeof useStation>;
  today?: string;
  bars: { speed?: number; still?: boolean };
  t: (key: CopyKey) => string;
}) {
  const { state, now, playing, volume, voice, blocked } = station;
  const item = currentItem(state.queue, now);
  const live = state.live.on;
  const spotify = useSpotifyAir(station);
  const onSpotify = !item && !live && spotify.active ? spotify.playlist : null;

  return (
    <>
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
        ) : onSpotify ? (
          <>
            <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-[#1ed760]">
              <SpotifyIcon className="h-3.5 w-3.5" /> Playlist de Spotify
            </p>
            <p className="mt-1 text-[1.65rem] font-semibold leading-tight tracking-[-0.03em] text-white md:text-3xl">{onSpotify.name}</p>
            <p className="mt-1.5 text-[15px] text-white/60">{onSpotify.description || t("radio.continuousNote")}</p>
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

      <Visualizer analyser={station.analyser} active={playing} className="radio-viz" speed={bars.speed} still={bars.still} />

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

      {spotify.involved && state.on_air ? (
        <div className="radio-spotify mt-5" data-active={onSpotify ? "" : undefined} data-sounding={spotify.sounding ? "" : undefined}>
          <div ref={spotify.mount} className="radio-spotify-embed" />
          <p className="mt-2 text-xs leading-5 text-white/55">{spotifyNote(spotify, state.name)}</p>
        </div>
      ) : null}

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
    </>
  );
}
