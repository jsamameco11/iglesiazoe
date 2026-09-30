import { videoMime, type MediaAsset } from "@/lib/media";

export function MediaView({
  asset,
  fit = "frame",
  className = "",
}: {
  asset: MediaAsset;
  fit?: "frame" | "cover" | "cutout" | "hero" | "raw";
  className?: string;
}) {
  if (!asset?.src) return null;

  if (asset.kind === "video") {
    const videoClass =
      fit === "cover"
        ? "media-cover"
        : fit === "hero"
          ? "h-full w-full object-cover"
          : fit === "raw"
            ? "object-cover"
            : "shot aspect-video w-full object-cover";
    return (
      <video
        className={`${videoClass} ${className}`.trim()}
        autoPlay
        muted
        loop
        playsInline
        poster={asset.poster || undefined}
        aria-label={asset.alt || undefined}
      >
        <source src={asset.src} type={videoMime(asset.src)} />
      </video>
    );
  }

  const imageClass =
    fit === "cover"
      ? "media-cover"
      : fit === "hero"
        ? "h-full w-full object-cover"
        : fit === "cutout"
          ? "cutout-blend w-full object-contain"
          : fit === "raw"
            ? "object-cover"
            : "frame";

  return <img src={asset.src} alt={asset.alt} className={`${imageClass} ${className}`.trim()} />;
}

export function PageBand({
  asset,
  className = "",
  ratio = "aspect-[16/10]",
}: {
  asset: MediaAsset;
  className?: string;
  ratio?: string;
}) {
  if (!asset?.src) return null;
  return (
    <div className={`shot relative bg-[#f6f1ea] ${ratio} ${className}`.trim()}>
      <MediaView asset={asset} fit="cover" />
    </div>
  );
}
