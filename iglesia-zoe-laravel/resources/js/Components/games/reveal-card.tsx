import { useRef, useState } from "react";
import type { OcultoCard } from "@/lib/games";

const OPEN_AT = 0.38;

/**
 * The sealed secret card of El Cristiano Oculto: drag the cover up (or tap the button, or
 * press Enter) to read it, so nobody sees it by accident while the phone changes hands.
 */
export function RevealCard({ card, onClose, closeLabel = "Ya la vi, ocultar" }: { card: OcultoCard; onClose?: () => void; closeLabel?: string }) {
  const [open, setOpen] = useState(false);
  const [lift, setLift] = useState(0);
  const start = useRef<number | null>(null);
  const box = useRef<HTMLDivElement>(null);

  function down(event: React.PointerEvent) {
    if (open) return;
    start.current = event.clientY;
    (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
  }
  function move(event: React.PointerEvent) {
    if (start.current === null || open) return;
    const height = box.current?.offsetHeight || 1;
    setLift(Math.min(1, Math.max(0, (start.current - event.clientY) / height)));
  }
  function up() {
    if (start.current === null) return;
    start.current = null;
    if (lift >= OPEN_AT) setOpen(true);
    setLift(0);
  }

  return (
    <div className="mx-auto w-full max-w-md">
      <div ref={box} className="relative min-h-[25rem] overflow-hidden rounded-[2rem] border border-line bg-card shadow-[0_30px_60px_-30px_rgba(28,24,20,0.45)]">
        <div className={`flex min-h-[25rem] flex-col items-center justify-center p-8 text-center transition-opacity duration-300 ${open ? "opacity-100" : "opacity-0"}`} aria-hidden={!open}>
          {card.impostor ? (
            <>
              <p className="kicker">Tu papel</p>
              <p className="editorial mt-4 text-4xl leading-tight text-accent">Eres el Cristiano Oculto</p>
              {card.category ? <p className="mt-4 rounded-full bg-sage px-4 py-1.5 text-sm font-medium text-ink">Tema: {card.category}</p> : null}
              <p className="mt-5 max-w-xs text-[15px] leading-7 text-muted">No conoces la palabra. Escucha las pistas de los demás y da una que te haga pasar desapercibido.</p>
            </>
          ) : (
            <>
              <p className="kicker">{card.category}</p>
              <p className="editorial mt-4 text-5xl leading-[1.05] text-ink">{card.word}</p>
              {card.description ? <p className="mt-4 max-w-xs text-[15px] leading-7 text-muted">{card.description}</p> : null}
              {card.reference ? <p className="mt-3 text-sm font-semibold text-accent">{card.reference}</p> : null}
              {card.clues?.length ? (
                <div className="mt-6">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">Ideas para tu pista</p>
                  <div className="mt-2 flex flex-wrap justify-center gap-2">
                    {card.clues.map((clue) => (
                      <span key={clue} className="rounded-full border border-accent/25 bg-accent-soft px-3 py-1 text-xs font-medium text-ink">{clue}</span>
                    ))}
                  </div>
                </div>
              ) : null}
            </>
          )}
        </div>

        {!open ? (
          <div
            role="button"
            tabIndex={0}
            aria-label="Desliza hacia arriba para ver tu tarjeta"
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={up}
            onPointerCancel={up}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                setOpen(true);
              }
            }}
            className="absolute inset-0 flex cursor-grab touch-none select-none flex-col items-center justify-between bg-ink p-8 text-paper active:cursor-grabbing"
            style={{ transform: `translateY(${-lift * 100}%)`, transition: start.current === null ? "transform 0.35s cubic-bezier(0.16, 1, 0.3, 1)" : "none" }}
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-paper/60">Tarjeta secreta</p>
            <div className="text-center">
              <svg viewBox="0 0 48 48" className="mx-auto h-14 w-14" aria-hidden>
                <path d="M24 34V14M15 23l9-9 9 9" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <p className="editorial mt-4 text-3xl">Desliza hacia arriba</p>
              <p className="mt-2 text-sm text-paper/60">Que nadie más mire la pantalla</p>
            </div>
            <button
              type="button"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => setOpen(true)}
              className="rounded-full border border-paper/30 px-5 py-2 text-sm font-medium text-paper/85 transition hover:bg-paper/10"
            >
              Abrir con un toque
            </button>
          </div>
        ) : null}
      </div>
      {open && onClose ? (
        <button type="button" onClick={onClose} className="btn-accent mt-5 w-full rounded-full px-6 py-3.5 text-sm font-semibold">
          {closeLabel}
        </button>
      ) : null}
      {open && !onClose ? (
        <button type="button" onClick={() => setOpen(false)} className="mt-4 w-full rounded-full border border-line bg-card px-6 py-3 text-sm font-semibold text-ink">
          Ocultar tarjeta
        </button>
      ) : null}
    </div>
  );
}
