import { mediaChromeStyle, mediaFocusStyle, normalizeFit, parseRatio, videoMime, type MediaAsset } from "@/lib/media";

export function MediaView({
  asset,
  fit = "auto",
  className = "",
}: {
  asset: MediaAsset;
  fit?: "auto" | "frame" | "cover" | "contain" | "cutout" | "hero" | "raw";
  className?: string;
}) {
  if (!asset?.src) return null;
  const mode = fit === "auto" || fit === "frame" ? normalizeFit(asset.fit) : fit;
  const focus = { ...mediaFocusStyle(asset), ...mediaChromeStyle(asset) };

  if (asset.kind === "video") {
    const videoClass =
      mode === "contain" || mode === "fit" || mode === "natural"
        ? "media-contain"
        : mode === "cover"
        ? "media-cover"
        : mode === "fill"
          ? "shot aspect-video w-full object-cover"
        : mode === "hero"
          ? "h-full w-full object-cover"
          : mode === "raw"
            ? "object-cover"
            : "shot-media";
    return (
      <video
        className={`${videoClass} ${className}`.trim()}
        style={focus}
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
    mode === "cover"
      ? "media-cover"
      : mode === "contain" || mode === "fit"
        ? "media-contain"
        : mode === "hero"
          ? "h-full w-full object-cover"
          : mode === "cutout"
            ? "cutout-blend w-full object-contain"
            : mode === "raw"
              ? "object-cover"
              : "frame";

  return <img src={asset.src} alt={asset.alt} className={`${imageClass} ${className}`.trim()} style={focus} />;
}

export function PageBand({
  asset,
  className = "",
}: {
  asset: MediaAsset;
  className?: string;
}) {
  if (!asset?.src) return null;
  const mode = normalizeFit(asset.fit);
  const ratio = parseRatio(asset.ratio);
  const box = ratio.css || (mode === "fill" ? "4 / 5" : "");

  const chrome = mediaChromeStyle(asset);

  if (mode === "natural" || !box) {
    return (
      <div className={`shot shot-natural ${className}`.trim()} style={chrome}>
        <MediaView asset={asset} fit="frame" />
      </div>
    );
  }

  return (
    <div
      className={`shot relative w-full ${className}`.trim()}
      style={{ ...chrome, aspectRatio: box, maxHeight: "min(68svh, 560px)" }}
    >
      <MediaView asset={asset} fit={mode === "fit" ? "contain" : "cover"} />
    </div>
  );
}
