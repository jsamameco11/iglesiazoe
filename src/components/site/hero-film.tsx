"use client";

import { useEffect, useRef, useState } from "react";
import { mediaFocusStyle, videoMime, type MediaAsset } from "@/lib/media";

function HeroMedia({ asset }: { asset: MediaAsset }) {
  const focus = mediaFocusStyle(asset);
  if (asset.kind === "video") {
    return (
      <video
        className="hero-bleed-media"
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
  return <img src={asset.src} alt={asset.alt} className="hero-bleed-media" style={focus} />;
}

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
    <section ref={ref} className="hero-bleed relative h-[100svh] min-h-[640px] w-full overflow-hidden">
      <div className="absolute inset-0" style={{ opacity: fade }}>
        <HeroMedia asset={asset} />
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
    <section className="hero-split grid min-h-[100svh] w-full bg-paper lg:grid-cols-2">
      <div className="order-2 flex flex-col justify-center px-6 py-16 text-ink md:px-12 lg:order-1 lg:px-16 lg:py-24">
        {children}
      </div>
      <div className="hero-bleed relative order-1 min-h-[48svh] overflow-hidden lg:order-2 lg:min-h-[100svh]">
        <HeroMedia asset={asset} />
      </div>
    </section>
  );
}
