import { useEffect, useState } from "react";
import { messengerUrl } from "@/lib/social";

const LABEL = "Escríbenos";
const CYCLE = 6000;
const TYPE_STEP = 95;
const ERASE_STEP = 45;

function useTypewriter(text: string) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const timers: number[] = [];
    const later = (fn: () => void, ms: number) => timers.push(window.setTimeout(fn, ms));

    const type = (from: number) => {
      for (let i = from + 1; i <= text.length; i++) later(() => setCount(i), (i - from) * TYPE_STEP);
    };
    const retype = () => {
      for (let i = 1; i <= text.length; i++) later(() => setCount(text.length - i), i * ERASE_STEP);
      later(() => type(0), text.length * ERASE_STEP + 260);
    };

    later(() => type(0), 900);
    const loop = window.setInterval(retype, CYCLE);

    return () => {
      timers.forEach((id) => window.clearTimeout(id));
      window.clearInterval(loop);
    };
  }, [text]);

  return text.slice(0, count);
}

function MessengerGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="wa-fab-glyph" aria-hidden="true">
      <path
        fill="currentColor"
        d="M.001 11.639C.001 4.949 5.241 0 12.001 0S24 4.95 24 11.639c0 6.689-5.24 11.638-12 11.638-1.21 0-2.38-.16-3.47-.46a.96.96 0 0 0-.64.05l-2.39 1.05a.96.96 0 0 1-1.35-.85l-.07-2.14a.97.97 0 0 0-.32-.68A11.39 11.389 0 0 1 .002 11.64zm8.32-2.19-3.52 5.6c-.35.53.32 1.139.82.75l3.79-2.87c.26-.2.6-.2.87 0l2.8 2.1c.84.63 2.04.4 2.6-.48l3.52-5.6c.35-.53-.32-1.13-.82-.75l-3.79 2.87c-.25.2-.6.2-.86 0l-2.8-2.1a1.8 1.8 0 0 0-2.61.48z"
      />
    </svg>
  );
}

function usePastHero() {
  const [past, setPast] = useState(false);

  useEffect(() => {
    const hero = document.querySelector<HTMLElement>(".hero-bleed, .hero-split");
    if (!hero) {
      setPast(true);
      return;
    }
    const onScroll = () => setPast(hero.getBoundingClientRect().bottom <= window.innerHeight * 0.55);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return past;
}

export function MessengerFab() {
  const typed = useTypewriter(LABEL);
  const visible = usePastHero();

  return (
    <a
      href={messengerUrl}
      target="_blank"
      rel="noreferrer"
      className="wa-fab"
      data-visible={visible ? "true" : "false"}
      tabIndex={visible ? undefined : -1}
      aria-hidden={visible ? undefined : true}
      aria-label="Escríbenos por Messenger"
    >
      <span className="wa-fab-bubble" aria-hidden="true">
        <span className="wa-fab-ghost">{LABEL}</span>
        <span className="wa-fab-typed">
          {typed}
          {typed.length < LABEL.length && <span className="wa-fab-caret" />}
        </span>
      </span>
      <span className="wa-fab-icon">
        <MessengerGlyph />
      </span>
    </a>
  );
}
