
import { Link } from "@inertiajs/react";
import { useRef, type ReactNode } from "react";
import { useScrollProgress } from "./use-scroll-progress";

export type ShiftPanel = {
  color: string;
  ink?: string;
  kicker: string;
  title: ReactNode;
  body: string;
  href: string;
  cta: string;
};

export function ColorShift({
  panels,
  portrait,
}: {
  panels: ShiftPanel[];
  portrait: { src: string; alt: string };
}) {
  const ref = useRef<HTMLDivElement>(null);
  const progress = useScrollProgress(ref);
  const index = Math.min(panels.length - 1, Math.floor(progress * 0.999 * panels.length));
  const panel = panels[index];

  return (
    <div ref={ref} className="relative" style={{ height: `${panels.length * 90}vh` }}>
      <div className="sticky top-[72px] isolate min-h-[calc(100svh-72px)]">
        <div
          className="absolute inset-0 transition-colors duration-700"
          style={{ background: panel.color }}
        />
        <div className="relative mx-auto grid min-h-[calc(100svh-72px)] max-w-[1400px] items-end gap-8 px-6 py-16 md:grid-cols-12 md:items-center md:px-12">
          <div className="md:col-span-6" style={{ color: panel.ink ?? "var(--ink)" }}>
            <p className="kicker" style={{ color: "inherit", opacity: 0.55 }}>
              {panel.kicker}
            </p>
            <div className="mt-5">{panel.title}</div>
            <p className="mt-6 max-w-md text-lg font-light leading-8 opacity-80">{panel.body}</p>
            <Link
              href={panel.href}
              className="mt-8 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-medium text-ink"
            >
              {panel.cta} <span aria-hidden>→</span>
            </Link>
            <div className="mt-10 flex gap-2">
              {panels.map((item, i) => (
                <span
                  key={item.kicker}
                  className="h-1.5 rounded-full bg-ink/20 transition-all duration-500"
                  style={{ width: i === index ? 36 : 10, background: i === index ? "rgba(31,32,36,0.7)" : "rgba(31,32,36,0.18)" }}
                />
              ))}
            </div>
          </div>
          <div className="md:col-span-6">
            <img
              src={portrait.src}
              alt={portrait.alt}
              className="cutout-blend mx-auto max-h-[78svh] w-full max-w-lg object-contain object-bottom"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
