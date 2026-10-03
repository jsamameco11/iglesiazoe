import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { can, usePanelUser } from "@/lib/access";
import { KIND_LABEL, clock, duration, limaDate, longDuration, shortTitle, type RadioUpcoming } from "@/lib/radio";
import type { ConsoleApi } from "./use-console";

const POSITION_KEY = "radio.console.alert-position";

type Position = { x: number; y: number };

function savedPosition(): Position | null {
  try {
    const value = JSON.parse(window.localStorage.getItem(POSITION_KEY) ?? "null") as Position | null;
    return value && Number.isFinite(value.x) && Number.isFinite(value.y) ? value : null;
  } catch {
    return null;
  }
}

/** Keeps the bubble inside the window. */
function clamp(position: Position, element: HTMLElement | null): Position {
  const width = element?.offsetWidth ?? 280;
  const height = element?.offsetHeight ?? 44;
  return {
    x: Math.min(Math.max(8, position.x), Math.max(8, window.innerWidth - width - 8)),
    y: Math.min(Math.max(8, position.y), Math.max(8, window.innerHeight - height - 8)),
  };
}

/**
 * Floating warning of the console: what the program has scheduled within the next 15 minutes
 * and what waits for the live transmission to end. It can be dragged anywhere (the place is
 * remembered); clicking it shows the details and lets the operator reprogram the block.
 */
export function UpcomingBubble({ api, openId, onOpen }: { api: ConsoleApi; openId: string | null; onOpen: (id: string | null) => void }) {
  const { upcoming, now } = api;
  const user = usePanelUser();
  const [hidden, setHidden] = useState<string[]>([]);
  const [position, setPosition] = useState<Position | null>(null);
  const [time, setTime] = useState("");
  const [busy, setBusy] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef<{ dx: number; dy: number; startX: number; startY: number; moved: boolean } | null>(null);

  const visible = upcoming.filter((block) => !hidden.includes(block.id) || block.id === openId);
  const selected = visible.find((block) => block.id === openId) ?? null;
  const first = selected ?? visible[0] ?? null;
  const live = Boolean(api.live.session || api.state.live.cut);

  useEffect(() => {
    setPosition(savedPosition());
  }, []);

  useEffect(() => {
    const keep = () => setPosition((value) => (value ? clamp(value, box.current) : value));
    window.addEventListener("resize", keep);
    return () => window.removeEventListener("resize", keep);
  }, []);

  useEffect(() => {
    if (openId && !upcoming.some((block) => block.id === openId)) onOpen(null);
  }, [openId, upcoming, onOpen]);

  useEffect(() => {
    setTime(selected ? clock(Math.max(selected.start, now) + 15 * 60000) : "");
  }, [selected?.id]);

  if (!first) return null;

  function onPointerDown(event: ReactPointerEvent<HTMLElement>) {
    if ((event.target as HTMLElement).closest("[data-no-drag]")) return;
    const rect = box.current!.getBoundingClientRect();
    drag.current = { dx: event.clientX - rect.left, dy: event.clientY - rect.top, startX: event.clientX, startY: event.clientY, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: ReactPointerEvent<HTMLElement>) {
    const state = drag.current;
    if (!state) return;
    if (!state.moved && Math.hypot(event.clientX - state.startX, event.clientY - state.startY) < 5) return;
    state.moved = true;
    setPosition(clamp({ x: event.clientX - state.dx, y: event.clientY - state.dy }, box.current));
  }

  function onPointerUp() {
    const state = drag.current;
    drag.current = null;
    if (!state) return;
    if (state.moved) {
      setPosition((value) => {
        if (value) window.localStorage.setItem(POSITION_KEY, JSON.stringify(value));
        return value;
      });
      return;
    }
    onOpen(selected ? null : first!.id);
  }

  async function move(change: Parameters<ConsoleApi["reschedule"]>[1]) {
    if (!selected) return;
    setBusy(true);
    const moved = await api.reschedule(selected.id, change);
    setBusy(false);
    if (moved && change.mode === "at") onOpen(null);
  }

  function hide(id: string) {
    setHidden((list) => [...list, id]);
    onOpen(null);
  }

  const place = position ? { left: position.x, top: position.y } : { right: 24, top: 84 };
  const others = visible.length - 1;

  return (
    <div ref={box} className="cx-bubble" data-open={selected ? "" : undefined} style={place} role="dialog" aria-label="Aviso de programación">
      <div
        className="cx-bubble-pill"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => (drag.current = null)}
        title="Arrástralo donde no estorbe · clic para ver qué está programado"
      >
        <span className="cx-bubble-dot" aria-hidden />
        <span className="cx-bubble-when">{first.held ? "En espera del vivo" : `Programado en ${duration(Math.max(0, first.start - now) / 1000)}`}</span>
        <span className="cx-bubble-title">{shortTitle(first.title, 34)}</span>
        {others > 0 && !selected ? <span className="cx-bubble-more">+{others}</span> : null}
        <span className="cx-bubble-grip" aria-hidden>⋮⋮</span>
      </div>

      {selected ? <Details block={selected} now={now} live={live} /> : null}

      {selected ? (
        <div className="cx-bubble-body" data-no-drag>
          <p className="cx-bubble-label">Reprogramar</p>
          <div className="flex flex-wrap gap-1.5">
            {[5, 15, 30].map((minutes) => (
              <button key={minutes} type="button" disabled={busy} onClick={() => move({ mode: "shift", minutes })} className="cx-btn" title={`Correr ${minutes} minutos`}>
                +{minutes} min
              </button>
            ))}
          </div>
          <form
            className="mt-2 flex items-center gap-1.5"
            onSubmit={(event) => {
              event.preventDefault();
              void move({ mode: "at", time, date: limaDate(Math.max(selected.start, now)) });
            }}
          >
            <label className="text-[11px] text-white/60" htmlFor="cx-bubble-time">A las</label>
            <input id="cx-bubble-time" type="time" value={time} onChange={(event) => setTime(event.target.value)} className="cx-select !h-[1.75rem] w-[6.5rem]" required />
            <button type="submit" disabled={busy || !time} className="cx-btn" data-tone="blue">Mover</button>
          </form>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-2.5">
            {can(user, "radio.schedule") ? (
              <a href={`/admin/radio/programacion?fecha=${limaDate(selected.start)}#bloque-${selected.id}`} className="text-[11.5px] font-semibold text-white/75 underline hover:text-white">
                Abrir en Programación
              </a>
            ) : (
              <span />
            )}
            <div className="flex gap-1.5">
              {visible.length > 1 ? (
                <button type="button" onClick={() => onOpen(visible[(visible.indexOf(selected) + 1) % visible.length].id)} className="cx-btn">
                  Siguiente aviso
                </button>
              ) : null}
              <button type="button" onClick={() => hide(selected.id)} className="cx-btn" title="Oculta este aviso; la programación no cambia">
                Ocultar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Details({ block, now, live }: { block: RadioUpcoming; now: number; live: boolean }) {
  const audio = block.kind !== "vivo" && block.kind !== "automatica";
  const status = block.held
    ? "La transmisión en vivo está al aire: sonará apenas termines, y lo que sigue se corre."
    : block.kind === "vivo"
      ? "Bloque en vivo: en modo automático la música se corta sola cuando te conectes."
      : live && audio
        ? "Estás en vivo: si a esa hora sigues al aire, esperará a que termines la transmisión."
        : `Sonará solo a las ${clock(block.start)}.`;

  return (
    <div className="cx-bubble-body" data-no-drag>
      <div className="flex items-center gap-2">
        <span className="cx-badge" data-tone="red">{KIND_LABEL[block.kind] ?? block.kind}</span>
        <span className="font-mono text-[12px] tabular-nums text-white/80">
          {block.held ? "pendiente" : `${clock(block.start)} – ${clock(block.end)}`}
        </span>
        <span className="text-[11px] text-white/50">{longDuration(block.duration)}</span>
      </div>
      <p className="mt-1.5 text-[14px] font-semibold leading-5 text-white">{block.title}</p>
      {block.artist ? <p className="text-[12px] text-white/60">{block.artist}</p> : null}
      {block.playlist ? <p className="mt-0.5 text-[12px] text-white/60">Música: {block.playlist}</p> : null}
      {block.note ? <p className="mt-1.5 rounded-md bg-white/5 px-2 py-1 text-[12px] leading-4 text-white/75">{block.note}</p> : null}
      <p className="mt-2 text-[11.5px] leading-4 text-red-200">
        {!block.held && block.start > now ? <strong className="font-semibold">Empieza en {duration((block.start - now) / 1000)}. </strong> : null}
        {status}
      </p>
    </div>
  );
}
