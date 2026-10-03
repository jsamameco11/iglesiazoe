import { Link, usePage } from "@inertiajs/react";
import { useEffect, useRef, useState } from "react";
import { readPairs, splitEmphasis, useCopy } from "@/lib/copy";
import type { SiteSettings } from "@/lib/types";
import { useSitePages } from "@/lib/site-pages";

const VERSE_MS = 4000;

function useVerseCycle(count: number) {
  const [index, setIndex] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [hidden, setHidden] = useState(false);
  const remaining = useRef(VERSE_MS);
  const shown = useRef(0);
  const paused = hovered || hidden;

  useEffect(() => {
    const sync = () => setHidden(document.visibilityState === "hidden");
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);

  useEffect(() => {
    if (shown.current !== index) {
      shown.current = index;
      remaining.current = VERSE_MS;
    }
    if (paused) return;
    const started = performance.now();
    let fired = false;
    const timer = window.setTimeout(() => {
      fired = true;
      setIndex((current) => (current + 1) % count);
    }, remaining.current);
    return () => {
      window.clearTimeout(timer);
      if (!fired) remaining.current = Math.max(0, remaining.current - (performance.now() - started));
    };
  }, [index, paused, count]);

  return { index, setIndex, paused, setHovered };
}

export function PrayerLight() {
  const pages = useSitePages();
  const { settings } = usePage().props as unknown as { settings?: SiteSettings };
  const t = useCopy();
  const verses = readPairs(settings, "prayer.verses");
  const steps = [
    { title: t("prayer.step1Title"), text: t("prayer.step1Text") },
    { title: t("prayer.step2Title"), text: t("prayer.step2Text") },
    { title: t("prayer.step3Title"), text: t("prayer.step3Text") },
  ];
  const { index, setIndex, paused, setHovered } = useVerseCycle(Math.max(verses.length, 1));

  return (
    <section className="prayer-light" data-art="prayer" aria-label="Cómo oramos por ti">
      <div className="prayer-light-halo" aria-hidden="true" />
      <span className="prayer-light-mark" aria-hidden="true">“</span>

      <div className="relative">
        <p className="prayer-light-kicker">{pages.section("contact", "prayer")}</p>
        <h2 className="editorial mt-4 text-[2.5rem] leading-[1.02] text-ink md:text-[3.1rem]">
          {splitEmphasis(t("prayer.title")).map((part, i) => (part.em ? <em key={i}>{part.text}</em> : <span key={i}>{part.text}</span>))}
        </h2>

        <div
          className="prayer-verse-card"
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          onFocus={() => setHovered(true)}
          onBlur={() => setHovered(false)}
        >
          <div className="prayer-verse" aria-live="polite">
            {verses.map((verse, i) => (
              <blockquote key={`${verse.ref}-${i}`} className="prayer-verse-item" data-on={i === index ? "true" : "false"} aria-hidden={i !== index}>
                <p className="editorial text-[1.4rem] italic leading-[1.38] md:text-[1.62rem]">{verse.text}</p>
                <cite className="prayer-verse-ref">{verse.ref}</cite>
              </blockquote>
            ))}
          </div>

          <div className="prayer-verse-nav">
            <div className="prayer-progress" role="tablist" aria-label="Versículos de oración">
              {verses.map((verse, i) => (
                <button
                  key={`${verse.ref}-${i}`}
                  type="button"
                  role="tab"
                  aria-selected={i === index}
                  aria-label={verse.ref || `Versículo ${i + 1}`}
                  className="prayer-progress-seg"
                  data-state={i === index ? "on" : i < index ? "done" : "off"}
                  data-paused={paused ? "true" : "false"}
                  style={{ ["--verse-ms" as string]: `${VERSE_MS}ms` }}
                  onClick={() => setIndex(i)}
                >
                  <span key={i === index ? `on-${index}` : "idle"} />
                </button>
              ))}
            </div>
            <span className="prayer-verse-count" aria-hidden="true">
              {String(index + 1).padStart(2, "0")} <span>/ {String(verses.length).padStart(2, "0")}</span>
            </span>
          </div>
        </div>
      </div>

      <ol className="prayer-steps">
        {steps.map((step, i) => (
          <li key={step.title} className="prayer-step" style={{ animationDelay: `${0.25 + i * 0.18}s` }}>
            <span className="prayer-step-num">{String(i + 1).padStart(2, "0")}</span>
            <div>
              <p className="text-[15px] font-semibold text-ink">{step.title}</p>
              <p className="mt-1 text-[13.5px] leading-6 text-muted">{step.text}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function InviteTitle({ text }: { text: string }) {
  const cut = text.lastIndexOf(" ");
  if (cut <= 0) return <em>{text}</em>;
  return (
    <>
      {text.slice(0, cut)} <em>{text.slice(cut + 1)}</em>
    </>
  );
}

export function VisitInvite({ sunday, wednesday }: { sunday?: string; wednesday?: string }) {
  const pages = useSitePages();
  const t = useCopy();
  return (
    <Link href="/visita" className="visit-invite group">
      <span className="visit-invite-shine" aria-hidden="true" />
      <span className="visit-invite-pin" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-6 w-6">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 21s6.5-5.4 6.5-10.2A6.5 6.5 0 0 0 5.5 10.8C5.5 15.6 12 21 12 21Z" />
          <circle cx="12" cy="10.5" r="2.2" />
        </svg>
      </span>
      <span className="relative min-w-0 flex-1">
        <span className="kicker block">{pages.section("contact", "visit")}</span>
        <span className="editorial mt-3 block text-[2.3rem] leading-[1.02] md:text-[3.2rem]">
          <InviteTitle text={t("contact.visitTitle")} />
        </span>
        <span className="mt-3 block max-w-xl text-[15px] leading-7 text-muted">
          {t("contact.visitText")}
          {(sunday || wednesday) && <span className="mt-1 block text-sm text-ink/70">{[sunday, wednesday].filter(Boolean).join(" · ")}</span>}
        </span>
      </span>
      <span className="visit-invite-arrow" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      </span>
    </Link>
  );
}
