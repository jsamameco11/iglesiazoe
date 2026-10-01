
import { useEffect, useRef, useState } from "react";
import { mediaFocusStyle, videoMime, type MediaAsset } from "@/lib/media";
import { ServiceCountdown } from "@/Components/site/service-countdown";

function HeroMedia({ asset, className }: { asset: MediaAsset; className: string }) {
  const focus = mediaFocusStyle(asset);
  if (asset.kind === "video") {
    return (
      <video
        className={className}
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
  return <img src={asset.src} alt={asset.alt} className={className} style={focus} />;
}

export function HeroFilm({
  asset,
  children,
  sunday,
  wednesday,
}: {
  asset: MediaAsset;
  children: React.ReactNode;
  sunday: string;
  wednesday: string;
}) {
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
    <section ref={ref} className="hero-bleed relative flex min-h-[max(100svh,560px)] w-full flex-col overflow-hidden">
      <div className="absolute inset-0" style={{ opacity: fade }}>
        <HeroMedia asset={asset} className="hero-bleed-media" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
      </div>
      <div className="hero-copy" style={{ opacity: fade }}>
        <div className="hero-copy-main">{children}</div>
        <ServiceCountdown sunday={sunday} wednesday={wednesday} />
      </div>
    </section>
  );
}

export function HeroSplit({
  asset,
  children,
  sunday,
  wednesday,
}: {
  asset: MediaAsset;
  children: React.ReactNode;
  sunday: string;
  wednesday: string;
}) {
  const ref = useRef<HTMLElement>(null);
  const [fade, setFade] = useState(1);

  useEffect(() => {
    const onScroll = () => {
      const node = ref.current;
      if (!node) return;
      const top = node.getBoundingClientRect().top;
      const height = node.offsetHeight || 1;
      const progress = Math.min(1, Math.max(0, -top / (height * 0.78)));
      setFade(1 - progress);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <section ref={ref} className="hero-split grid min-h-[100svh] w-full lg:h-[100svh] lg:grid-cols-2">
      <div className="hero-split-pane relative h-[52svh] min-h-[280px] w-full lg:h-full lg:min-h-0" style={{ opacity: fade }}>
        <HeroMedia asset={asset} className="hero-split-media" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/40 to-transparent lg:h-32" />
        <div className="service-chip-split hidden lg:block">
          <ServiceCountdown sunday={sunday} wednesday={wednesday} />
        </div>
      </div>
      <div className="flex flex-col justify-center px-5 pb-10 pt-8 text-ink md:px-12 lg:px-16 lg:py-24">
        {children}
        <div className="mt-8 lg:hidden">
          <ServiceCountdown sunday={sunday} wednesday={wednesday} />
        </div>
      </div>
    </section>
  );
}
