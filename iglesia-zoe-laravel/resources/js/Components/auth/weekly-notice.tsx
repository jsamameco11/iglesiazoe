import { useCallback, useEffect, useId, useRef, useState, type RefObject } from "react";

export type NoticePoint = { title: string; text: string };

export type WeeklyNotice = {
  enabled: boolean;
  kicker: string;
  title: string;
  period: string;
  intro: string;
  points: NoticePoint[];
  closing: string;
  updated_at?: string | null;
  updated_by?: string | null;
};

const CLOSE_MS = 280;
const FONT_ID = "weekly-notice-fonts";
const FONT_HREF = "https://fonts.bunny.net/css?family=plus-jakarta-sans:400,500,600,700&display=swap";

function useNoticeFonts() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let link = document.getElementById(FONT_ID) as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement("link");
      link.id = FONT_ID;
      link.rel = "stylesheet";
      link.href = FONT_HREF;
      document.head.appendChild(link);
    }

    let active = true;
    const finish = () => active && setReady(true);
    const timer = window.setTimeout(finish, 900);
    const wait = () => {
      if (!document.fonts) return finish();
      Promise.all([document.fonts.load('500 2rem "Cormorant Garamond"'), document.fonts.load('600 1rem "Plus Jakarta Sans"')]).finally(finish);
    };
    if (link.sheet) wait();
    else link.addEventListener("load", wait, { once: true });

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, []);

  return ready;
}

function updatedLabel(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `Actualizado el ${date.toLocaleDateString("es-PE", { day: "numeric", month: "long" })}`;
}

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]" aria-hidden="true">
      <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

export function NoticeCard({
  notice,
  titleId,
  onClose,
  closeRef,
  nudge = false,
  className = "",
}: {
  notice: WeeklyNotice;
  titleId?: string;
  onClose?: () => void;
  closeRef?: RefObject<HTMLButtonElement | null>;
  nudge?: boolean;
  className?: string;
}) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const [moreBelow, setMoreBelow] = useState(false);
  const points = notice.points.filter((point) => point.title.trim() || point.text.trim());
  const updated = updatedLabel(notice.updated_at);
  useNoticeFonts();

  const measure = useCallback(() => {
    const body = bodyRef.current;
    if (!body) return;
    setMoreBelow(body.scrollHeight - body.scrollTop - body.clientHeight > 8);
  }, []);

  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure, notice]);

  return (
    <article className={`weekly-notice-card flex min-h-0 flex-col overflow-hidden bg-card text-ink ${className}`}>
      <header className="relative shrink-0 px-5 pt-5 pb-4 sm:px-8 sm:pt-7">
        <div className="flex items-start justify-between gap-4">
          <p className="notice-label inline-flex items-center gap-2 rounded-full bg-paper px-3 py-1.5 text-accent">
            <BellIcon />
            {notice.kicker || "Indicaciones de la semana"}
          </p>
          {onClose && (
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              aria-label="Cerrar indicaciones"
              data-nudge={nudge ? "true" : "false"}
              className="weekly-notice-close -mt-1 -mr-1 grid h-11 w-11 shrink-0 place-items-center rounded-full border border-line bg-white text-ink transition hover:bg-ink hover:text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/30"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-5 w-5" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          )}
        </div>
        <h2 id={titleId} className="notice-title mt-5 text-[2.4rem] text-ink sm:text-[3rem]">
          {notice.title || "Indicaciones de la semana"}
        </h2>
        {notice.period && (
          <p className="mt-3 inline-flex items-center gap-2 text-[13px] font-medium tabular-nums text-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            {notice.period}
          </p>
        )}
      </header>

      <div className="relative flex min-h-0 flex-1 flex-col">
        <div ref={bodyRef} onScroll={measure} className="weekly-notice-body min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5 sm:px-8">
          {notice.intro && <p className="notice-copy whitespace-pre-line border-t border-line pt-4 text-[15px] leading-[1.65] text-muted">{notice.intro}</p>}
          <ol className={`space-y-2.5 ${notice.intro ? "mt-5" : "border-t border-line pt-5"}`}>
            {points.map((point, index) => (
              <li key={index} className="flex gap-4 rounded-2xl border border-line bg-white/70 p-4">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent text-[14px] font-bold leading-none tabular-nums text-white">
                  {index + 1}
                </span>
                <div className="min-w-0 pt-1">
                  <p className="text-[15.5px] font-semibold leading-snug tracking-[-0.012em] text-ink">{point.title}</p>
                  {point.text && <p className="notice-copy mt-1.5 whitespace-pre-line break-words text-[14px] leading-[1.6] text-muted">{point.text}</p>}
                </div>
              </li>
            ))}
            {!points.length && <li className="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-muted">Aún no hay puntos publicados.</li>}
          </ol>
        </div>
        <div className="weekly-notice-fade" data-on={moreBelow ? "true" : "false"} aria-hidden="true" />
      </div>

      {(notice.closing || updated) && (
        <footer className="weekly-notice-footer flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-line px-5 pt-3.5 sm:px-8 sm:pb-5">
          {notice.closing && <p className="notice-serif text-[1.15rem] italic leading-6 text-ink">{notice.closing}</p>}
          {updated && <p className="notice-label text-muted">{updated}</p>}
        </footer>
      )}
    </article>
  );
}

export function WeeklyNoticeModal({ notice }: { notice: WeeklyNotice }) {
  const titleId = `${useId().replace(/:/g, "")}-notice-title`;
  const [state, setState] = useState<"pending" | "open" | "closing" | "closed">("pending");
  const [nudge, setNudge] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const reopenRef = useRef<HTMLButtonElement>(null);
  const nudgeTimer = useRef<number | undefined>(undefined);
  const visible = state === "open" || state === "closing";
  const fontsReady = useNoticeFonts();

  useEffect(() => {
    if (!fontsReady) return;
    const timer = window.setTimeout(() => setState((current) => (current === "pending" ? "open" : current)), 150);
    return () => window.clearTimeout(timer);
  }, [fontsReady]);

  const remind = useCallback(() => {
    window.clearTimeout(nudgeTimer.current);
    setNudge(false);
    window.requestAnimationFrame(() => setNudge(true));
    nudgeTimer.current = window.setTimeout(() => setNudge(false), 900);
    closeRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    if (state !== "open") return;
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = "hidden";
    closeRef.current?.focus({ preventScroll: true });

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        remind();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      root.style.overflow = previous;
    };
  }, [state, remind]);

  useEffect(() => () => window.clearTimeout(nudgeTimer.current), []);

  function close() {
    setState("closing");
    window.setTimeout(() => {
      setState("closed");
      window.requestAnimationFrame(() => reopenRef.current?.focus({ preventScroll: true }));
    }, CLOSE_MS);
  }

  return (
    <>
      {visible && (
        <div className="weekly-notice-layer fixed inset-0 z-[90] flex items-end justify-center sm:items-center sm:p-6" data-state={state}>
          <div className="weekly-notice-backdrop absolute inset-0" onClick={remind} aria-hidden="true" />
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            data-nudge={nudge ? "true" : "false"}
            className="weekly-notice-dialog relative flex max-h-[92dvh] w-full flex-col sm:max-h-[min(86vh,52rem)] sm:max-w-[38rem]"
          >
            <NoticeCard
              notice={notice}
              titleId={titleId}
              onClose={close}
              closeRef={closeRef}
              nudge={nudge}
              className="rounded-t-[1.75rem] shadow-[0_-12px_48px_-12px_rgba(20,16,12,0.45)] sm:rounded-[1.75rem] sm:shadow-[0_40px_90px_-30px_rgba(20,16,12,0.6)]"
            />
          </div>
        </div>
      )}
      <button
        ref={reopenRef}
        type="button"
        onClick={() => setState("open")}
        data-visible={state === "closed" ? "true" : "false"}
        className="weekly-notice-fab fixed right-4 z-[60] inline-flex items-center gap-2.5 rounded-full bg-ink py-2.5 pr-4 pl-3 text-[13px] font-semibold text-white shadow-[0_18px_36px_-16px_rgba(20,16,12,0.6)] transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/40 sm:right-6"
        aria-label="Ver indicaciones de la semana"
      >
        <span className="grid h-7 w-7 place-items-center rounded-full bg-accent">
          <BellIcon />
        </span>
        <span className="sm:hidden">Indicaciones</span>
        <span className="hidden sm:inline">Indicaciones de la semana</span>
        {notice.points.length > 0 && (
          <span className="grid h-5 min-w-5 place-items-center rounded-full bg-white/15 px-1.5 text-[11px]">{notice.points.length}</span>
        )}
      </button>
    </>
  );
}
