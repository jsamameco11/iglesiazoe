"use client";

import { useLayoutEffect, useRef, useState } from "react";

type Reveal = "up" | "left" | "right" | "scale";
type Phase = "live" | "hidden" | "shown";

export function Rise({
  children,
  className = "",
  delay = 0,
  from = "up",
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  from?: Reveal;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<Phase>("hidden");

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setPhase("live");
      return;
    }

    const rect = node.getBoundingClientRect();
    const view = window.innerHeight || document.documentElement.clientHeight;
    if (rect.top < view * 0.42 && rect.bottom > 32) {
      setPhase("live");
      return;
    }

    setPhase("hidden");
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setPhase("shown");
        observer.unobserve(node);
      },
      { threshold: 0.14, rootMargin: "0px 0px -12% 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      data-reveal={from}
      data-state={phase}
      style={phase === "shown" ? { transitionDelay: `${delay}ms` } : undefined}
      className={`rise ${className}`.trim()}
    >
      {children}
    </div>
  );
}
