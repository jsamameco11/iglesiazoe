import { Link } from "@inertiajs/react";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { send } from "@/lib/actions";
import { setPrayers, useInboxShared, usePendingPrayers, type PendingPrayer, type PendingPrayers } from "@/lib/inbox";
import "../../../css/prayer-bubble.css";

const POSITION_KEY = "zoe:prayer-bubble";
const SOUND_KEY = "zoe:prayer-bubble-sound";
const SIZE = 60;
const MARGIN = 14;
const GAP = 12;
const DRAG_THRESHOLD = 5;
const TOAST_MS = 9000;
const LONG_REQUEST = 220;

/* Newest request already announced in this tab, kept across page visits so each new one chimes only once. */
let announcedUntil: number | null = null;

type Spot = { fx: number; fy: number };

const timeFormat = new Intl.DateTimeFormat("es-PE", { timeZone: "America/Lima", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

function received(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const minutes = Math.round((Date.now() - date.getTime()) / 60000);
  if (minutes < 1) return "Hace un momento";
  if (minutes < 60) return `Hace ${minutes} min`;
  if (minutes < 60 * 24) return `Hace ${Math.round(minutes / 60)} h`;
  return timeFormat.format(date);
}

function readSpot(): Spot {
  try {
    const saved = JSON.parse(localStorage.getItem(POSITION_KEY) || "null") as Spot | null;
    if (saved && Number.isFinite(saved.fx) && Number.isFinite(saved.fy)) {
      return { fx: Math.min(1, Math.max(0, saved.fx)), fy: Math.min(1, Math.max(0, saved.fy)) };
    }
  } catch {
    /* a damaged value falls back to the corner */
  }
  return { fx: 1, fy: 1 };
}

function toPixels(spot: Spot) {
  const width = Math.max(0, window.innerWidth - SIZE - MARGIN * 2);
  const height = Math.max(0, window.innerHeight - SIZE - MARGIN * 2);
  return { x: MARGIN + spot.fx * width, y: MARGIN + spot.fy * height };
}

function toSpot(x: number, y: number): Spot {
  const width = Math.max(1, window.innerWidth - SIZE - MARGIN * 2);
  const height = Math.max(1, window.innerHeight - SIZE - MARGIN * 2);
  return { fx: Math.min(1, Math.max(0, (x - MARGIN) / width)), fy: Math.min(1, Math.max(0, (y - MARGIN) / height)) };
}

/** Soft two-note chime; browsers only let it sound after the first tap on the page. */
function chime() {
  try {
    const AudioCtor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtor) return;
    const context = new AudioCtor();
    [880, 1318.5].forEach((frequency, index) => {
      const start = context.currentTime + index * 0.16;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.09, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.55);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.6);
    });
    window.setTimeout(() => context.close().catch(() => undefined), 1200);
  } catch {
    /* no audio on this device */
  }
}

function HandsGlyph({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M24 40V22l-6-11c-1-1.8-3.6-1-3.4 1l1.4 11-4 5v12" />
      <path d="M24 40V22l6-11c1-1.8 3.6-1 3.4 1L32 23l4 5v12" />
      <path d="M24 6v4M16 8l1.6 3.4M32 8l-1.6 3.4" />
    </svg>
  );
}

function SoundGlyph({ on }: { on: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-[17px] w-[17px]" aria-hidden="true">
      <path d="M4 9.5h3.2L12 5.5v13l-4.8-4H4z" />
      {on ? <path d="M15.5 9a4.2 4.2 0 0 1 0 6M18 6.5a7.8 7.8 0 0 1 0 11" /> : <path d="m16 9.5 5 5m0-5-5 5" />}
    </svg>
  );
}

function OnAirBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[#c62f2f] px-2 py-0.5 text-[9.5px] font-extrabold uppercase tracking-[0.14em] text-white">
      <span className="h-1.5 w-1.5 rounded-full bg-white" aria-hidden />
      Al aire
    </span>
  );
}

function PrayerItem({ prayer, busy, onRemove }: { prayer: PendingPrayer; busy: boolean; onRemove: () => void }) {
  const [full, setFull] = useState(false);
  const long = prayer.request.length > LONG_REQUEST;

  return (
    <article className="pb-item border-b border-line px-5 py-4 last:border-b-0" data-on-air={prayer.on_air || undefined}>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="rounded-full px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.12em] text-white" style={{ background: prayer.network.color }}>
          {prayer.network.label}
        </span>
        {prayer.on_air && <OnAirBadge />}
        {prayer.created_at && (
          <time dateTime={prayer.created_at} className="ml-auto text-[11px] text-muted">
            {received(prayer.created_at)}
          </time>
        )}
      </div>
      <h3 className="mt-2 text-[15px] font-semibold leading-tight tracking-[-0.01em]">
        {prayer.full_name}
        {prayer.age ? <span className="font-normal text-muted"> · {prayer.age} años</span> : null}
      </h3>
      {prayer.topic && <p className="mt-0.5 text-[12px] font-medium text-muted">Motivo: {prayer.topic}</p>}
      <p className={`mt-2 whitespace-pre-line text-[13.5px] leading-6 ${full || !long ? "" : "pb-clamp"}`}>{prayer.request}</p>
      <div className="mt-3 flex items-center justify-between gap-2">
        {long ? (
          <button type="button" onClick={() => setFull((value) => !value)} className="text-[12px] font-semibold text-muted underline-offset-4 hover:text-ink hover:underline">
            {full ? "Ver menos" : "Leer completa"}
          </button>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={onRemove}
          disabled={busy}
          className="rounded-full border border-line bg-white px-3.5 py-1.5 text-[12px] font-semibold text-muted transition hover:border-ink/30 hover:text-ink disabled:opacity-50"
          title="La quita de la burbuja. Sigue guardada en Peticiones de oración."
        >
          Quitar
        </button>
      </div>
    </article>
  );
}

/** Draggable bubble on every panel page with the prayer requests each account has not removed yet. */
export function PrayerBubble() {
  const pending = usePendingPrayers(useInboxShared()?.prayers);
  const [spot, setSpot] = useState<Spot | null>(null);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [open, setOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [filter, setFilter] = useState<"all" | "air">("all");
  const [sound, setSound] = useState(true);
  const [fresh, setFresh] = useState<PendingPrayer | null>(null);
  const [nudge, setNudge] = useState(false);
  const [confirmAll, setConfirmAll] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const drag = useRef<{ id: number; startX: number; startY: number; originX: number; originY: number; moved: boolean; spot?: Spot } | null>(null);
  const suppressClick = useRef(false);
  const orb = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSpot(readSpot());
    setSound(localStorage.getItem(SOUND_KEY) !== "off");
    const onResize = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const total = pending?.total ?? 0;

  useEffect(() => {
    if (!pending) return;
    const stamp = (item: PendingPrayer) => (item.created_at ? new Date(item.created_at).getTime() : 0);
    const newest = pending.items.reduce((latest, item) => Math.max(latest, stamp(item)), 0);
    if (announcedUntil === null) {
      announcedUntil = newest;
      return;
    }
    const since = announcedUntil;
    const arrived = pending.items.filter((item) => stamp(item) > since);
    announcedUntil = Math.max(since, newest);
    if (!arrived.length) return;
    setFresh(arrived[0]);
    setNudge(true);
    if (localStorage.getItem(SOUND_KEY) !== "off") chime();
  }, [pending]);

  useEffect(() => {
    if (!fresh) return;
    const timer = window.setTimeout(() => setFresh(null), TOAST_MS);
    return () => window.clearTimeout(timer);
  }, [fresh]);

  useEffect(() => {
    if (!nudge) return;
    const timer = window.setTimeout(() => setNudge(false), 2000);
    return () => window.clearTimeout(timer);
  }, [nudge]);

  useEffect(() => {
    if (total === 0) {
      setOpen(false);
      setConfirmAll(false);
    }
    if (!pending?.onAir) setFilter("all");
  }, [total, pending?.onAir]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        orb.current?.focus();
      }
    };
    const onDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!panel.current?.contains(target) && !orb.current?.contains(target)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  const remove = useCallback(
    async (ids: string[] | null) => {
      if (!pending) return;
      const before = pending;
      const gone = new Set(ids ?? before.items.map((item) => item.id));
      const removed = before.items.filter((item) => gone.has(item.id));
      const optimistic: PendingPrayers = ids
        ? { total: Math.max(0, before.total - removed.length), onAir: Math.max(0, before.onAir - removed.filter((item) => item.on_air).length), items: before.items.filter((item) => !gone.has(item.id)) }
        : { total: 0, onAir: 0, items: [] };
      setError("");
      setBusy(true);
      setPrayers(optimistic);
      const result = await send("/admin/formularios/oraciones/quitar", ids ? { ids } : { all: "1" });
      setBusy(false);
      if (result.error) {
        setPrayers(before);
        setError(result.error);
        return;
      }
      setConfirmAll(false);
      if (result.prayers) setPrayers(result.prayers as PendingPrayers);
    },
    [pending],
  );

  function toggleSound() {
    const next = !sound;
    setSound(next);
    localStorage.setItem(SOUND_KEY, next ? "on" : "off");
    if (next) chime();
  }

  function onPointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
    if (event.button !== 0 || !spot) return;
    const origin = toPixels(spot);
    drag.current = { id: event.pointerId, startX: event.clientX, startY: event.clientY, originX: origin.x, originY: origin.y, moved: false };
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* the pointer already ended */
    }
  }

  function onPointerMove(event: ReactPointerEvent<HTMLButtonElement>) {
    const current = drag.current;
    if (!current || current.id !== event.pointerId) return;
    const dx = event.clientX - current.startX;
    const dy = event.clientY - current.startY;
    if (!current.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    if (!current.moved) {
      current.moved = true;
      setDragging(true);
    }
    current.spot = toSpot(current.originX + dx, current.originY + dy);
    setSpot(current.spot);
  }

  function onPointerUp(event: ReactPointerEvent<HTMLButtonElement>) {
    const current = drag.current;
    if (!current || current.id !== event.pointerId) return;
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (!current.moved) return;
    suppressClick.current = true;
    setDragging(false);
    if (current.spot) localStorage.setItem(POSITION_KEY, JSON.stringify(current.spot));
  }

  function onClick() {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    setFresh(null);
    setOpen((value) => !value);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (!event.altKey || !spot) return;
    const step = 0.05;
    const moves: Record<string, Spot> = {
      ArrowLeft: { fx: spot.fx - step, fy: spot.fy },
      ArrowRight: { fx: spot.fx + step, fy: spot.fy },
      ArrowUp: { fx: spot.fx, fy: spot.fy - step },
      ArrowDown: { fx: spot.fx, fy: spot.fy + step },
    };
    const next = moves[event.key];
    if (!next) return;
    event.preventDefault();
    const clamped = { fx: Math.min(1, Math.max(0, next.fx)), fy: Math.min(1, Math.max(0, next.fy)) };
    setSpot(clamped);
    localStorage.setItem(POSITION_KEY, JSON.stringify(clamped));
  }

  if (!pending || total === 0 || !spot || !viewport.width) return null;

  const { x, y } = toPixels(spot);
  const onRight = x + SIZE / 2 > viewport.width / 2;
  const below = y + SIZE / 2 <= viewport.height / 2;
  const horizontal: CSSProperties = onRight ? { right: Math.max(MARGIN, viewport.width - (x + SIZE)) } : { left: Math.max(MARGIN, x) };
  const vertical: CSSProperties = below ? { top: y + SIZE + GAP } : { bottom: viewport.height - y + GAP };
  const room = below ? viewport.height - (y + SIZE + GAP) - MARGIN : y - GAP - MARGIN;
  const items = filter === "air" ? pending.items.filter((item) => item.on_air) : pending.items;
  const label = `${total} ${total === 1 ? "petición de oración pendiente" : "peticiones de oración pendientes"}${pending.onAir ? `, ${pending.onAir} para orar al aire` : ""}`;

  return (
    <>
      <button
        ref={orb}
        type="button"
        className="pb-orb"
        style={{ left: x, top: y }}
        data-open={open || undefined}
        data-dragging={dragging || undefined}
        data-on-air={pending.onAir > 0 || undefined}
        data-fresh={nudge || undefined}
        aria-label={`${label}. Toca para ver; arrástrala o usa Alt y las flechas para moverla.`}
        aria-expanded={open}
        aria-controls="prayer-bubble-panel"
        title="Peticiones de oración · arrástrala para moverla"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClick={onClick}
        onKeyDown={onKeyDown}
      >
        <HandsGlyph />
        <span className="pb-count">{total > 99 ? "99+" : total}</span>
        {pending.onAir > 0 && <span className="pb-air-tag">AL AIRE</span>}
      </button>

      {fresh && !open && (
        <button type="button" className="pb-toast" style={{ ...horizontal, ...vertical }} onClick={() => { setFresh(null); setOpen(true); }} role="status">
          <span className="flex items-center gap-2">
            <span className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-orange-deep">Nueva petición de oración</span>
            {fresh.on_air && <OnAirBadge />}
          </span>
          <span className="mt-1 block text-sm font-semibold">{fresh.full_name}</span>
          {fresh.topic && <span className="block text-[12px] text-muted">Motivo: {fresh.topic}</span>}
          <span className="mt-1.5 block text-[12px] font-semibold text-ink/70">Toca para leerla →</span>
        </button>
      )}

      {open && (
        <div
          ref={panel}
          id="prayer-bubble-panel"
          role="dialog"
          aria-label="Peticiones de oración pendientes"
          className="pb-panel"
          style={{ ...horizontal, ...vertical, maxHeight: Math.max(240, Math.min(room, 600)) }}
        >
          <header className="border-b border-line px-5 pb-3.5 pt-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-muted">Pendientes</p>
                <h2 className="mt-0.5 text-lg font-semibold leading-tight tracking-[-0.02em]">Peticiones de oración</h2>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={toggleSound}
                  aria-pressed={sound}
                  title={sound ? "Sonido activado al llegar una nueva" : "Sonido desactivado"}
                  aria-label={sound ? "Desactivar el sonido" : "Activar el sonido"}
                  className={`grid h-8 w-8 place-items-center rounded-full transition hover:bg-paper ${sound ? "text-ink" : "text-muted"}`}
                >
                  <SoundGlyph on={sound} />
                </button>
                <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar" className="grid h-8 w-8 place-items-center rounded-full text-lg leading-none text-muted transition hover:bg-paper hover:text-ink">
                  ×
                </button>
              </div>
            </div>
            {pending.onAir > 0 && (
              <div className="mt-3 flex gap-1 rounded-full border border-line bg-paper/70 p-1" role="group" aria-label="Filtrar peticiones">
                {(
                  [
                    ["all", `Todas · ${total}`],
                    ["air", `Al aire · ${pending.onAir}`],
                  ] as const
                ).map(([key, text]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setFilter(key)}
                    aria-pressed={filter === key}
                    className={`flex-1 rounded-full px-3 py-1.5 text-[12px] font-semibold transition ${filter === key ? "bg-ink text-white" : "text-muted hover:text-ink"}`}
                  >
                    {text}
                  </button>
                ))}
              </div>
            )}
          </header>

          <div className="pb-list">
            {items.map((prayer) => (
              <PrayerItem key={prayer.id} prayer={prayer} busy={busy} onRemove={() => remove([prayer.id])} />
            ))}
            {!items.length && <p className="px-5 py-10 text-center text-sm text-muted">No hay peticiones con ese filtro.</p>}
            {total > pending.items.length && (
              <p className="px-5 pb-4 text-center text-[11.5px] text-muted">Se muestran las {pending.items.length} más recientes. Al quitarlas aparecen las siguientes.</p>
            )}
          </div>

          <footer className="border-t border-line bg-paper/50 px-5 py-3">
            {error && <p className="mb-2 text-[12px] text-red-700" role="alert">{error}</p>}
            {confirmAll ? (
              <div className="space-y-2">
                <p className="text-[12.5px] leading-5">
                  ¿Quitar {total === 1 ? "la petición" : `las ${total} peticiones`} de la burbuja? Seguirán guardadas en Peticiones de oración.
                </p>
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setConfirmAll(false)} className="rounded-full px-3.5 py-1.5 text-[12px] font-semibold text-muted hover:text-ink">
                    Cancelar
                  </button>
                  <button type="button" disabled={busy} onClick={() => remove(null)} className="rounded-full bg-ink px-4 py-1.5 text-[12px] font-semibold text-white transition hover:bg-ink/90 disabled:opacity-60">
                    Sí, quitar todas
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <Link href="/admin/formularios/oraciones" onClick={() => setOpen(false)} className="text-[12.5px] font-semibold text-ink underline-offset-4 hover:underline">
                  Ver en Peticiones de oración →
                </Link>
                <button type="button" onClick={() => setConfirmAll(true)} className="text-[12px] font-semibold text-muted transition hover:text-ink">
                  Quitar todas
                </button>
              </div>
            )}
          </footer>
        </div>
      )}
    </>
  );
}
