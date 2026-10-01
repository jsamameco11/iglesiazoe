import type { CSSProperties } from "react";
import { mediaFocusStyle, videoMime, type MediaAsset } from "@/lib/media";

function RibbonMedia({ item }: { item: MediaAsset }) {
  const focus = mediaFocusStyle(item);
  if (item.kind === "video") {
    return (
      <video autoPlay muted loop playsInline poster={item.poster || undefined} style={focus}>
        <source src={item.src} type={videoMime(item.src)} />
      </video>
    );
  }
  return <img src={item.src} alt={item.alt} loading="lazy" style={focus} />;
}

export function PhotoRibbon({
  items,
  label,
  secondsPerPhoto = 8,
}: {
  items: MediaAsset[];
  label: string;
  secondsPerPhoto?: number;
}) {
  const photos = items.filter((item) => item.src);
  if (photos.length === 0) return null;
  const loop = [...photos, ...photos];
  const style = { "--ribbon-duration": `${photos.length * secondsPerPhoto}s` } as CSSProperties;

  return (
    <div className="photo-ribbon" role="region" aria-roledescription="carrusel" aria-label={label} style={style}>
      <div className="photo-ribbon-track">
        {loop.map((photo, index) => (
          <figure key={`${photo.src}-${index}`} className="photo-ribbon-card" aria-hidden={index >= photos.length || undefined}>
            <span className="photo-ribbon-media">
              <RibbonMedia item={photo} />
            </span>
          </figure>
        ))}
      </div>
    </div>
  );
}
