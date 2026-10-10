import { useRef, useState } from "react";
import { GameEmblem } from "@/Components/games/ui";
import type { OcultoCard } from "@/lib/games";

const OPEN_AT = 0.38;

const LEVEL = { intermedio: "Intermedio", dificil: "Difícil" };

/**
 * The sealed secret card of El Cristiano Oculto: drag the cover up (or tap the button, or
 * press Enter) to read it, so nobody sees it by accident while the phone changes hands.
 */
export function RevealCard({ card, onClose, closeLabel = "Ya la vi, ocultar", owner }: { card: OcultoCard; onClose?: () => void; closeLabel?: string; owner?: string }) {
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
      <div ref={box} className="secret-card" data-role={card.impostor ? "hidden" : "faithful"}>
        <div className={`relative flex min-h-[26rem] flex-col p-8 text-center transition-opacity duration-300 md:p-9 ${open ? "opacity-100" : "opacity-0"}`} aria-hidden={!open}>
          {!card.impostor ? <span className="secret-frame" /> : null}
          <div className="flex items-center justify-between gap-3 text-left">
            <span className="game-label">{card.impostor ? "Tu papel" : card.category}</span>
            {card.level ? (
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${card.impostor ? "bg-white/10 text-white/80" : "bg-accent-soft text-accent"}`}>{LEVEL[card.level]}</span>
            ) : null}
          </div>
          {card.impostor ? (
            <div className="my-auto flex flex-col items-center py-6">
              <span className="grid h-20 w-20 place-items-center rounded-full bg-white/10 ring-1 ring-white/15">
                <GameEmblem game="oculto" className="h-12 w-12" />
              </span>
              <p className="editorial mt-6 text-[2.4rem] leading-[1.05] text-white">Eres el Cristiano Oculto</p>
              {card.category ? <p className="mt-4 rounded-full bg-accent px-4 py-1.5 text-sm font-semibold text-white">Tema: {card.category}</p> : null}
              <p className="mt-5 max-w-xs text-[15px] leading-7 text-white/70">No conoces la palabra. Escucha las pistas de los demás y da una que te haga pasar desapercibido.</p>
            </div>
          ) : (
            <div className="my-auto flex flex-col items-center py-6">
              <p className="game-label">Palabra secreta</p>
              <p className="editorial mt-3 text-[2.6rem] leading-[1.02] md:text-5xl">{card.word}</p>
              {card.description ? <p className="mt-4 max-w-xs text-[15px] leading-7 text-muted">{card.description}</p> : null}
              {card.reference ? <p className="mt-3 text-sm font-semibold text-accent">{card.reference}</p> : null}
              {card.clues?.length ? (
                <div className="mt-6 w-full border-t border-line pt-5">
                  <p className="game-label">Ideas para tu pista</p>
                  <div className="mt-3 flex flex-wrap justify-center gap-2">
                    {card.clues.map((clue) => (
                      <span key={clue} className="rounded-full border border-accent/25 bg-accent-soft px-3 py-1 text-xs font-medium text-ink">
                        {clue}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
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
            className="secret-cover flex cursor-grab touch-none select-none flex-col items-center justify-between p-9 active:cursor-grabbing"
            style={{ transform: `translateY(${-lift * 100}%)`, transition: start.current === null ? "transform 0.35s cubic-bezier(0.16, 1, 0.3, 1)" : "none" }}
          >
            <div className="text-center">
              <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-white/55">Tarjeta secreta</p>
              {owner ? <p className="mt-2 text-sm font-medium text-white/80">de {owner}</p> : null}
            </div>
            <div className="text-center">
              <span className="secret-hint mx-auto grid h-16 w-16 place-items-center rounded-full border border-white/25 bg-white/[0.06]">
                <svg viewBox="0 0 48 48" className="h-8 w-8" aria-hidden>
                  <path d="M24 36V12M14 22l10-10 10 10" stroke="currentColor" strokeWidth="3.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <p className="editorial mt-5 text-3xl text-white">Desliza hacia arriba</p>
              <p className="mt-2 text-sm text-white/60">Que nadie más mire la pantalla</p>
            </div>
            <button
              type="button"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => setOpen(true)}
              className="min-h-11 rounded-full border border-white/25 px-5 text-sm font-semibold text-white/90 transition hover:bg-white/10"
            >
              Abrir con un toque
            </button>
          </div>
        ) : null}
      </div>
      {open && onClose ? (
        <button type="button" onClick={onClose} className="btn-accent mt-5 min-h-12 w-full rounded-full px-6 text-[15px] font-semibold shadow-[0_14px_28px_-16px_var(--accent)]">
          {closeLabel}
        </button>
      ) : null}
      {open && !onClose ? (
        <button type="button" onClick={() => setOpen(false)} className="mt-4 min-h-12 w-full rounded-full border border-line bg-card px-6 text-[15px] font-semibold text-ink transition hover:border-ink/30">
          Ocultar tarjeta
        </button>
      ) : null}
    </div>
  );
}
