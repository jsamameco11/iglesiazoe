import { useState } from "react";
import { IconPlay } from "@/Components/site/icons";
import { videoMime, type MediaAsset } from "@/lib/media";

/** A YouTube video that loads only after the visitor presses play, or an uploaded video. */
export function VideoFeature({ youtube, asset, title }: { youtube?: string; asset?: MediaAsset; title: string }) {
  const [playing, setPlaying] = useState(false);

  if (youtube) {
    return (
      <div className="video-frame">
        {playing ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${youtube}?autoplay=1&rel=0`}
            title={title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <button type="button" className="absolute inset-0 block h-full w-full" onClick={() => setPlaying(true)} aria-label={`Reproducir: ${title}`}>
            <img src={`https://i.ytimg.com/vi/${youtube}/hqdefault.jpg`} alt="" loading="lazy" />
            <span className="video-play">
              <span>
                <IconPlay className="h-7 w-7" />
              </span>
            </span>
          </button>
        )}
      </div>
    );
  }

  if (asset?.kind === "video" && asset.src) {
    return (
      <div className="video-frame">
        <video controls playsInline preload="metadata" poster={asset.poster || undefined} aria-label={title}>
          <source src={asset.src} type={videoMime(asset.src)} />
        </video>
      </div>
    );
  }

  return null;
}
