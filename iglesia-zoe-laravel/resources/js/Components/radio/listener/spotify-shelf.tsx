import { useState } from "react";
import { Rise } from "@/Components/motion/rise";
import { SpotifyIcon } from "@/Components/radio/icons";
import type { CopyKey } from "@/lib/copy";
import { section } from "@/lib/design";
import type { RadioSpotifyPlaylist } from "@/lib/radio";

/**
 * «Escúchanos en Spotify»: the church's playlists with their cover and text. Each one opens in
 * the listener's Spotify, or plays here in Spotify's own player (loaded only when asked).
 */
export function SpotifyShelf({ playlists, t }: { playlists: RadioSpotifyPlaylist[]; t: (key: CopyKey) => string }) {
  const [open, setOpen] = useState<string | null>(null);
  if (!playlists.length) return null;

  return (
    <section {...section("spotify", "Spotify")} id="spotify" className="mt-24 scroll-mt-24">
      <Rise className="max-w-xl">
        <p className="kicker inline-flex items-center gap-2">
          <SpotifyIcon className="h-4 w-4 text-[#1db954]" /> {t("radio.spotifyKicker")}
        </p>
        <h2 className="editorial mt-4 text-4xl leading-[1.05] md:text-5xl">{t("radio.spotifyTitle")}</h2>
        <p className="mt-4 text-[15px] leading-7 text-muted">{t("radio.spotifyText")}</p>
      </Rise>

      <div className="spotify-shelf mt-10">
        {playlists.map((playlist) => (
          <Rise key={playlist.id} className="spotify-card">
            {open === playlist.id ? (
              <iframe
                title={playlist.name}
                src={playlist.embed}
                className="aspect-square w-full rounded-xl border-0 bg-black/40"
                allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                loading="lazy"
              />
            ) : playlist.cover ? (
              <img src={playlist.cover} alt="" className="aspect-square w-full rounded-xl object-cover" loading="lazy" />
            ) : (
              <span className="grid aspect-square w-full place-items-center rounded-xl bg-[#1db954]/15 text-[#1db954]">
                <SpotifyIcon className="h-14 w-14" />
              </span>
            )}
            <h3 className="mt-4 truncate text-[1.05rem] font-semibold tracking-[-0.01em] text-white">{playlist.name}</h3>
            {playlist.description ? <p className="mt-1 line-clamp-2 text-[13.5px] leading-5 text-white/60">{playlist.description}</p> : null}
            <div className="mt-4 flex flex-wrap gap-2">
              <a href={playlist.url} target="_blank" rel="noreferrer" className="spotify-open">
                <SpotifyIcon className="h-4 w-4" /> {t("radio.spotifyOpen")}
              </a>
              {open === playlist.id ? null : (
                <button type="button" onClick={() => setOpen(playlist.id)} className="spotify-listen">
                  {t("radio.spotifyListen")}
                </button>
              )}
            </div>
          </Rise>
        ))}
      </div>
    </section>
  );
}
