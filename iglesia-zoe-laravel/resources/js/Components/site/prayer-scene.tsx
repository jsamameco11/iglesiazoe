import { Link } from "@inertiajs/react";
import { useEffect, useRef, useState } from "react";

const VERSES = [
  { text: "Por nada estéis afanosos, sino sean conocidas vuestras peticiones delante de Dios.", ref: "Filipenses 4:6" },
  { text: "Clama a mí, y yo te responderé, y te enseñaré cosas grandes y ocultas que tú no conoces.", ref: "Jeremías 33:3" },
  { text: "Pedid, y se os dará; buscad, y hallaréis; llamad, y se os abrirá.", ref: "Mateo 7:7" },
  { text: "Echando toda vuestra ansiedad sobre él, porque él tiene cuidado de vosotros.", ref: "1 Pedro 5:7" },
  { text: "Cercano está Jehová a todos los que le invocan, a todos los que le invocan de veras.", ref: "Salmos 145:18" },
  { text: "Orad unos por otros… La oración eficaz del justo puede mucho.", ref: "Santiago 5:16" },
];

const VERSE_MS = 4000;

const STEPS = [
  { title: "Escribe tu petición", text: "Cuéntanos el motivo con la confianza de que será tratado con respeto." },
  { title: "Oramos por ti", text: "Nuestro equipo de intercesión presenta cada petición delante de Dios durante la semana." },
  { title: "Te acompañamos", text: "Si nos dejas tu teléfono, un servidor de la casa puede escribirte." },
];

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
  const { index, setIndex, paused, setHovered } = useVerseCycle(VERSES.length);

  return (
    <section className="prayer-light" aria-label="Cómo oramos por ti">
      <div className="prayer-light-halo" aria-hidden="true" />
      <span className="prayer-light-mark" aria-hidden="true">“</span>

      <div className="relative">
        <p className="prayer-light-kicker">Oramos contigo</p>
        <h2 className="editorial mt-4 text-[2.5rem] leading-[1.02] text-ink md:text-[3.1rem]">
          No tienes que <em>cargarlo solo.</em>
        </h2>

        <div
          className="prayer-verse-card"
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          onFocus={() => setHovered(true)}
          onBlur={() => setHovered(false)}
        >
          <div className="prayer-verse" aria-live="polite">
            {VERSES.map((verse, i) => (
              <blockquote key={verse.ref} className="prayer-verse-item" data-on={i === index ? "true" : "false"} aria-hidden={i !== index}>
                <p className="editorial text-[1.4rem] italic leading-[1.38] md:text-[1.62rem]">{verse.text}</p>
                <cite className="prayer-verse-ref">{verse.ref}</cite>
              </blockquote>
            ))}
          </div>

          <div className="prayer-verse-nav">
            <div className="prayer-progress" role="tablist" aria-label="Versículos de oración">
              {VERSES.map((verse, i) => (
                <button
                  key={verse.ref}
                  type="button"
                  role="tab"
                  aria-selected={i === index}
                  aria-label={verse.ref}
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
              {String(index + 1).padStart(2, "0")} <span>/ {String(VERSES.length).padStart(2, "0")}</span>
            </span>
          </div>
        </div>
      </div>

      <ol className="prayer-steps">
        {STEPS.map((step, i) => (
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

export function VisitInvite({ sunday, wednesday }: { sunday?: string; wednesday?: string }) {
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
        <span className="kicker block">¿Quieres conocernos en persona?</span>
        <span className="editorial mt-3 block text-[2.3rem] leading-[1.02] md:text-[3.2rem]">
          Planifica tu <em>visita</em>
        </span>
        <span className="mt-3 block max-w-xl text-[15px] leading-7 text-muted">
          Déjanos tus datos y un equipo de la casa te recibirá en tu primera visita.
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
