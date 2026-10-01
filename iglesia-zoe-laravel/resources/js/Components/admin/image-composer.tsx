
import { useRef, useState } from "react";
import { mediaChromeStyle, mediaFocusStyle, videoMime, type MediaFit, type MediaKind } from "@/lib/media";

export function ImageComposer({
  src,
  kind,
  poster,
  fit,
  ratioCss,
  posX,
  posY,
  zoom,
  radius,
  feather,
  onMove,
  onZoom,
}: {
  src: string;
  kind: MediaKind;
  poster?: string;
  fit: MediaFit;
  ratioCss: string;
  posX: number;
  posY: number;
  zoom: number;
  radius: number;
  feather: number;
  onMove: (x: number, y: number) => void;
  onZoom: (value: number) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; posX: number; posY: number } | null>(null);
  const [grabbing, setGrabbing] = useState(false);
  const style = mediaFocusStyle({ posX, posY, zoom });
  const contain = fit === "fit" || fit === "natural";

  const startDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { x: event.clientX, y: event.clientY, posX, posY };
    setGrabbing(true);
  };

  const moveDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current || !box.current) return;
    const rect = box.current.getBoundingClientRect();
    const dx = ((event.clientX - drag.current.x) / Math.max(rect.width, 1)) * 100;
    const dy = ((event.clientY - drag.current.y) / Math.max(rect.height, 1)) * 100;
    onMove(
      Math.min(100, Math.max(0, Math.round(drag.current.posX - dx))),
      Math.min(100, Math.max(0, Math.round(drag.current.posY - dy))),
    );
  };

  const endDrag = () => {
    drag.current = null;
    setGrabbing(false);
  };

  return (
    <div>
      <div
        ref={box}
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className={`relative bg-sage ${grabbing ? "cursor-grabbing" : "cursor-grab"}`}
        style={{ aspectRatio: ratioCss || "4 / 5", ...mediaChromeStyle({ radius, feather }) }}
      >
        {kind === "video" ? (
          <video
            key={src}
            className={`pointer-events-none absolute inset-0 h-full w-full ${contain ? "object-contain" : "object-cover"}`}
            style={style}
            muted
            playsInline
            autoPlay
            loop
            poster={poster || undefined}
          >
            <source src={src} type={videoMime(src)} />
          </video>
        ) : (
          <img src={src} alt="" className={`pointer-events-none absolute inset-0 h-full w-full ${contain ? "object-contain" : "object-cover"}`} style={style} />
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/45 to-transparent px-3 py-2 text-[11px] font-medium text-white">
          Arrastra para mover la foto
        </div>
      </div>
      <label className="mt-3 block text-sm">
        Acercar
        <input
          type="range"
          min={100}
          max={220}
          step={1}
          value={zoom}
          onChange={(event) => onZoom(Number(event.target.value))}
          className="mt-1 w-full accent-ink"
        />
        <span className="mt-1 block text-xs text-muted">{zoom}%</span>
      </label>
    </div>
  );
}

