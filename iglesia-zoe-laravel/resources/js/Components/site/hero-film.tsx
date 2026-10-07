
import { useEffect, useRef, useState } from "react";
import { mediaFocusStyle, slidesOf, videoMime, type MediaAsset } from "@/lib/media";
import { ServiceCountdown } from "@/Components/site/service-countdown";
import { SlideDots, useSlideshow } from "@/Components/site/slideshow";
import { section } from "@/lib/design";

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
  const slides = slidesOf(asset);
  const { active, go } = useSlideshow(slides.length, 6500);

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
    <section {...section("hero", "Portada")} ref={ref} className="hero-bleed relative flex min-h-[max(100svh,560px)] w-full flex-col overflow-hidden">
      <div className="absolute inset-0" style={{ opacity: fade }}>
        {slides.length > 1 ? (
          slides.map((slide, index) => (
            <div key={index} className="hero-slide" data-active={index === active || undefined} aria-hidden={index !== active}>
              <HeroMedia asset={slide} className="hero-bleed-media" />
            </div>
          ))
        ) : (
          <HeroMedia asset={asset} className="hero-bleed-media" />
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
      </div>
      {slides.length > 1 ? <SlideDots total={slides.length} active={active} onPick={go} className="hero-dots" /> : null}
      <div className="hero-copy" style={{ opacity: fade }}>
        <div className="hero-copy-main">{children}</div>
        <ServiceCountdown sunday={sunday} wednesday={wednesday} />
      </div>
    </section>
  );
}
