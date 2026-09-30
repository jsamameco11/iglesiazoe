"use client";

import { useEffect, useRef, useState } from "react";
import { videoMime, type MediaAsset } from "@/lib/media";

export function HeroFilm({ asset, children }: { asset: MediaAsset; children: React.ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  const [fade, setFade] = useState(1);

  useEffect(() => {
    const onScroll = () => {
      const node = ref.current;
      if (!node) return;
      const top = node.getBoundingClientRect().top;
      const height = node.offsetHeight || 1;
      const progress = Math.min(1, Math.max(0, -top / (height * 0.8)));
      setFade(1 - progress);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <section ref={ref} className="relative h-[100svh] min-h-[640px] w-full overflow-hidden">
      <div className="absolute inset-0" style={{ opacity: fade }}>
        {asset.kind === "video" ? (
          <video
            className="h-full w-full object-cover"
            autoPlay
            muted
            loop
            playsInline
            poster={asset.poster || undefined}
            aria-label={asset.alt || undefined}
          >
            <source src={asset.src} type={videoMime(asset.src)} />
          </video>
        ) : (
          <img src={asset.src} alt={asset.alt} className="h-full w-full object-cover" />
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-black/15 to-transparent" />
      </div>
      <div className="relative flex h-full flex-col justify-end px-6 pb-16 md:px-14 md:pb-20" style={{ opacity: fade }}>
        {children}
      </div>
    </section>
  );
}

export function HeroSplit({ asset, children }: { asset: MediaAsset; children: React.ReactNode }) {
  return (
    <section className="grid min-h-[100svh] bg-paper lg:grid-cols-[1.05fr_0.95fr]">
      <div className="relative min-h-[52svh] overflow-hidden lg:min-h-[100svh]">
        {asset.kind === "video" ? (
          <video
            className="absolute inset-0 h-full w-full object-cover"
            autoPlay
            muted
            loop
            playsInline
            poster={asset.poster || undefined}
            aria-label={asset.alt || undefined}
          >
            <source src={asset.src} type={videoMime(asset.src)} />
          </video>
        ) : (
          <img src={asset.src} alt={asset.alt} className="absolute inset-0 h-full w-full object-cover" />
        )}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/45 to-transparent lg:h-24" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-paper to-transparent" />
      </div>
      <div className="flex flex-col justify-center px-6 py-16 md:px-12 lg:px-16 lg:py-24">
        {children}
      </div>
    </section>
  );
}
