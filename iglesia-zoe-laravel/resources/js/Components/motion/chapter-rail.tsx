
import { Link } from "@inertiajs/react";
import { useRef, type ReactNode } from "react";
import { useScrollProgress } from "./use-scroll-progress";

export type Chapter = {
  id: string;
  href: string;
  color: string;
  ink?: string;
  kicker: string;
  title: ReactNode;
  body: string;
  cta: string;
  image?: { src: string; alt: string; cutout?: boolean };
  detail?: ReactNode;
};

export function ChapterRail({ chapters }: { chapters: Chapter[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const progress = useScrollProgress(ref);
  const compact = progress < 0.08;
  const span = (1 - 0.08) / chapters.length;
  const active = compact ? -1 : Math.min(chapters.length - 1, Math.floor((progress - 0.08) / span));
  const chapter = chapters[Math.max(active, 0)];

  return (
    <div ref={ref} className="relative" style={{ height: `${140 + chapters.length * 88}vh` }}>
      <div className="sticky top-[72px] flex min-h-[calc(100svh-72px)] items-center px-4 py-10 md:px-10 lg:px-16">
        <div
          className={`mx-auto grid w-full max-w-[1400px] gap-3 transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            compact
              ? "grid-cols-2 auto-rows-[110px] md:h-[148px] md:grid-cols-4 md:auto-rows-auto"
              : "h-[min(78svh,720px)] grid-cols-1 md:grid-cols-[minmax(0,1fr)_200px]"
          }`}
        >
          {compact
            ? chapters.map((item) => (
                <Link
                  key={item.id}
                  href={`#${item.id}`}
                  onClick={(event) => {
                    event.preventDefault();
                    const index = chapters.findIndex((chapterItem) => chapterItem.id === item.id);
                    const target = ref.current;
                    if (!target) return;
                    const start = target.offsetTop + window.innerHeight * 0.2;
                    const length = target.offsetHeight - window.innerHeight;
                    window.scrollTo({ top: start + ((index + 0.35) / chapters.length) * length, behavior: "smooth" });
                  }}
                  className="flex items-center justify-center rounded-[1.6rem] px-4 text-center"
                  style={{ background: item.color, color: item.ink ?? "var(--ink)" }}
                >
                  {item.title}
                </Link>
              ))
            : (
              <>
                <article
                  className="relative isolate overflow-hidden rounded-[2rem] px-7 py-8 md:px-12 md:py-12"
                  style={{ background: chapter.color, color: chapter.ink ?? "var(--ink)" }}
                >
                  {chapter.image && (
                    <img
                      src={chapter.image.src}
                      alt={chapter.image.alt}
                      className={`pointer-events-none absolute ${
                        chapter.image.cutout
                          ? "cutout-blend -right-6 bottom-0 hidden h-[88%] w-auto max-w-[46%] object-contain md:block"
                          : "right-[-8%] top-[12%] hidden h-[78%] w-[48%] rounded-[1.6rem] object-cover opacity-90 md:block"
                      }`}
                    />
                  )}
                  <div className="relative max-w-xl">
                    <p className="kicker" style={{ color: "inherit", opacity: 0.55 }}>
                      {chapter.kicker}
                    </p>
                    <div className="mt-5">{chapter.title}</div>
                    <p className="mt-6 max-w-md text-base font-light leading-7 opacity-80 md:text-lg md:leading-8">
                      {chapter.body}
                    </p>
                    {chapter.detail}
                    <Link
                      href={chapter.href}
                      className="mt-8 inline-flex items-center gap-2 rounded-full bg-white/90 px-5 py-2.5 text-sm font-medium text-ink transition hover:bg-white"
                    >
                      {chapter.cta} <span aria-hidden>→</span>
                    </Link>
                  </div>
                </article>
                <div className="hidden flex-col gap-3 md:flex">
                  {chapters.map((item, index) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        const target = ref.current;
                        if (!target) return;
                        const start = target.offsetTop + window.innerHeight * 0.2;
                        const length = target.offsetHeight - window.innerHeight;
                        window.scrollTo({ top: start + ((index + 0.35) / chapters.length) * length, behavior: "smooth" });
                      }}
                      className="flex flex-1 items-center justify-center rounded-[1.4rem] px-3 text-center transition-transform duration-500"
                      style={{
                        background: item.color,
                        color: item.ink ?? "var(--ink)",
                        transform: index === active ? "scale(1.02)" : "scale(0.97)",
                        opacity: index === active ? 1 : 0.7,
                      }}
                    >
                      {item.title}
                    </button>
                  ))}
                </div>
              </>
            )}
        </div>
      </div>
    </div>
  );
}
