import { Link } from "@inertiajs/react";
import { useLayoutEffect, useRef, useState } from "react";
import type { ResolvedMedia } from "@/lib/media";
import type { Ministry } from "@/lib/types";

export function MinistryStrip({
  ministries,
  media,
}: {
  ministries: Ministry[];
  media: ResolvedMedia;
}) {
  const ref = useRef<HTMLElement>(null);
  const [shown, setShown] = useState(false);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(true);
      return;
    }

    const inView = () => {
      const rect = node.getBoundingClientRect();
      const view = window.innerHeight || document.documentElement.clientHeight;
      return rect.top < view * 0.78 && rect.bottom > view * 0.18;
    };

    let frame = 0;
    const play = () => setShown(true);
    const playAfterPaint = () => {
      frame = requestAnimationFrame(() => {
        frame = requestAnimationFrame(play);
      });
    };

    if (inView()) {
      playAfterPaint();
      return () => cancelAnimationFrame(frame);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        playAfterPaint();
        observer.disconnect();
      },
      { threshold: 0.22, rootMargin: "0px 0px -6% 0px" },
    );
    observer.observe(node);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  return (
    <section
      ref={ref}
      className="ministry-strip"
      data-state={shown ? "shown" : "hidden"}
      style={{ ["--ministry-count" as string]: String(ministries.length || 1) }}
      aria-label="Ministerios"
    >
      {ministries.map((ministry, index) => {
        const asset = media.ministry(ministry.slug, ministry.name);
        return (
          <Link
            key={ministry.slug}
            href={`/ministerios/${ministry.slug}`}
            className="ministry-panel"
            style={{ transitionDelay: shown ? `${index * 140}ms` : "0ms" }}
          >
            {asset.kind === "video" ? (
              <video
                className="ministry-shot"
                autoPlay
                muted
                loop
                playsInline
                poster={asset.poster || undefined}
                aria-label={asset.alt || ministry.name}
              >
                <source src={asset.src} />
              </video>
            ) : (
              <img className="ministry-shot" src={asset.src} alt={asset.alt || ministry.name} />
            )}
            <span className="ministry-shade" />
            <span className="ministry-copy">
              <span className="ministry-age">{ministry.age_range}</span>
              <span className="ministry-name">{ministry.name}</span>
              <span className="ministry-summary">{ministry.summary}</span>
            </span>
          </Link>
        );
      })}
    </section>
  );
}
