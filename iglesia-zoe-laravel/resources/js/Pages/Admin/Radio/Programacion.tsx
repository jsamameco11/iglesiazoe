import { router } from "@inertiajs/react";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { KindTag, RadioHeader } from "@/Components/radio/admin-ui";
import { Notice, button, ghost, input, useAction } from "@/Components/admin/ui";
import AdminLayout from "@/Layouts/AdminLayout";
import { send } from "@/lib/actions";
import { KIND_LABEL, clock, dayLabel, duration, longDuration, type RadioBlock, type RadioConfig, type RadioTrack } from "@/lib/radio";
import "../../../../css/radio.css";

type Day = { date: string; blocks: number; seconds: number };

type Props = {
  date: string;
  today: string;
  now: number;
  blocks: RadioBlock[];
  dayEnd: number | null;
  days: Day[];
  tracks: RadioTrack[];
  config: RadioConfig;
};

const DAY_MS = 86400000;
const WEEKDAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

function dayStart(date: string) {
  return Date.parse(`${date}T00:00:00-05:00`);
}

function addDays(date: string, days: number) {
  return new Date(dayStart(date) + days * DAY_MS + 12 * 3600000).toLocaleDateString("en-CA", { timeZone: "America/Lima" });
}

function useNow(initial: number) {
  const offset = useRef(initial - Date.now());
  const [now, setNow] = useState(initial);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now() + offset.current), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

export default function Programacion({ date, today, now: serverNow, blocks, dayEnd, days, tracks, config }: Props) {
  const now = useNow(serverNow);
  const start = dayStart(date);
  const end = start + DAY_MS;
  const [editing, setEditing] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const isToday = date === today;
  const isPast = date < today;
  const total = blocks.reduce((sum, block) => sum + (Math.min(block.end, end) - Math.max(block.start, start)), 0) / 1000;

  function go(next: string) {
    router.get("/admin/radio/programacion", { fecha: next }, { preserveScroll: true });
  }

  function togglePreview(block: RadioBlock) {
    audio.current ??= new Audio();
    if (preview === block.id) {
      audio.current.pause();
      setPreview(null);
      return;
    }
    if (!block.src) return;
    audio.current.src = block.src;
    audio.current.onended = () => setPreview(null);
    void audio.current.play();
    setPreview(block.id);
  }

  useEffect(() => () => audio.current?.pause(), []);

  const rows = useMemo(() => {
    const list: ({ type: "gap"; from: number; to: number } | { type: "block"; block: RadioBlock })[] = [];
    let cursor = start;
    for (const block of blocks) {
      if (block.start - cursor > 1000) list.push({ type: "gap", from: cursor, to: block.start });
      list.push({ type: "block", block });
      cursor = Math.max(cursor, block.end);
    }
    if (end - cursor > 1000) list.push({ type: "gap", from: cursor, to: end });
    return list;
  }, [blocks, start, end]);

  return (
    <AdminLayout>
      <RadioHeader
        title="Programación"
        text="Arma la línea de tiempo de cada día: canciones, anuncios, efectos, programas grabados y bloques en vivo, a la hora exacta. Los espacios libres se llenan solos con la música continua de la biblioteca."
      />

      <div className="mt-6 flex gap-2 overflow-x-auto pb-2 [scrollbar-width:thin]">
        {days.map((day) => (
          <button
            key={day.date}
            type="button"
            onClick={() => go(day.date)}
            className={`min-w-[6.6rem] shrink-0 rounded-2xl border px-3 py-2.5 text-left transition ${day.date === date ? "border-ink bg-ink text-white" : "border-line bg-white hover:border-ink/30"}`}
          >
            <span className="block text-[13px] font-semibold capitalize">{dayLabel(day.date, today)}</span>
            <span className={`mt-0.5 block text-[11px] ${day.date === date ? "text-white/60" : "text-muted"}`}>
              {day.blocks ? `${day.blocks} bloques · ${longDuration(day.seconds)}` : "Vacío"}
            </span>
          </button>
        ))}
        <label className="flex shrink-0 items-center gap-2 rounded-2xl border border-dashed border-line bg-white px-3 text-xs font-semibold text-muted">
          Otro día
          <input type="date" value={date} onChange={(event) => event.target.value && go(event.target.value)} className="rounded-lg border border-line px-2 py-1 text-sm text-ink" />
        </label>
      </div>

      <section className="mt-4 rounded-[1.6rem] border border-line bg-card p-5 md:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">Línea de tiempo</p>
            <h2 className="mt-1 text-2xl font-semibold capitalize tracking-[-0.03em]">
              {new Date(start + 12 * 3600000).toLocaleDateString("es-PE", { timeZone: "America/Lima", weekday: "long", day: "numeric", month: "long" })}
            </h2>
          </div>
          <p className="text-sm text-muted">
            {blocks.length} bloques · {longDuration(total)} programados · {config.autofill ? `${longDuration(Math.max(0, 86400 - total))} de música continua` : "música continua apagada"}
          </p>
        </div>
        <div className="tl-ruler mt-5">
          {blocks.map((block) => {
            const left = ((Math.max(block.start, start) - start) / DAY_MS) * 100;
            const width = ((Math.min(block.end, end) - Math.max(block.start, start)) / DAY_MS) * 100;
            return (
              <a
                key={block.id}
                href={`#bloque-${block.id}`}
                className={`tl-block tl-kind-${block.kind}`}
                style={{ left: `${left}%`, width: `${width}%` }}
                title={`${clock(block.start)}–${clock(block.end)} · ${block.title}`}
              />
            );
          })}
          {isToday ? <span className="tl-now" style={{ left: `${((now - start) / DAY_MS) * 100}%` }} /> : null}
        </div>
        <div className="mt-1.5 flex justify-between px-0.5 text-[10.5px] tabular-nums text-muted">
          {[0, 3, 6, 9, 12, 15, 18, 21, 24].map((hour) => (
            <span key={hour}>{String(hour).padStart(2, "0")}:00</span>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-3 text-[11.5px] text-muted">
          {(["musica", "anuncio", "efecto", "programa", "vivo"] as const).map((kind) => (
            <span key={kind} className="inline-flex items-center gap-1.5">
              <span className={`h-2.5 w-2.5 rounded-sm tl-kind-${kind}`} /> {KIND_LABEL[kind]}
            </span>
          ))}
        </div>
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_25rem]">
        <section className="min-w-0 rounded-[1.6rem] border border-line bg-card p-4 md:p-6">
          {blocks.length === 0 ? (
            <p className="rounded-[1.4rem] border border-dashed border-line px-5 py-10 text-center text-sm text-muted">
              Este día no tiene bloques. {config.autofill ? "Sonará la música continua de la biblioteca todo el día." : "Con la música continua apagada, la radio estará en silencio."} Agrega bloques con el panel de la derecha.
            </p>
          ) : (
            <div className="space-y-1">
              {rows.map((row) =>
                row.type === "gap" ? (
                  <div key={`gap-${row.from}`} className="tl-item py-2">
                    <p className="pt-1 text-right font-mono text-[11px] tabular-nums text-muted">{clock(row.from)}</p>
                    <p className="ml-6 rounded-xl border border-dashed border-line px-3 py-2 text-[12.5px] text-muted">
                      {config.autofill ? "Música continua" : "Silencio"} · {longDuration((row.to - row.from) / 1000)}
                    </p>
                  </div>
                ) : (
                  <BlockRow
                    key={row.block.id}
                    block={row.block}
                    date={date}
                    now={now}
                    editing={editing === row.block.id}
                    previewing={preview === row.block.id}
                    onEdit={() => setEditing(editing === row.block.id ? null : row.block.id)}
                    onPreview={() => togglePreview(row.block)}
                  />
                ),
              )}
            </div>
          )}
        </section>

        <aside className="space-y-6 xl:sticky xl:top-6 xl:self-start">
          {isPast ? (
            <p className="rounded-[1.4rem] border border-line bg-card p-5 text-sm text-muted">Este día ya pasó. Puedes copiar su programación a días futuros.</p>
          ) : (
            <AddPanel date={date} isToday={isToday} dayEnd={dayEnd} tracks={tracks} />
          )}
          <DayTools date={date} today={today} hasBlocks={blocks.length > 0} />
        </aside>
      </div>
    </AdminLayout>
  );
}

function BlockRow({
  block,
  date,
  now,
  editing,
  previewing,
  onEdit,
  onPreview,
}: {
  block: RadioBlock;
  date: string;
  now: number;
  editing: boolean;
  previewing: boolean;
  onEdit: () => void;
  onPreview: () => void;
}) {
  const { result, setResult, pending, run } = useAction();
  const isNow = block.start <= now && now < block.end;
  const past = block.end <= now;

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    data.set("id", block.id);
    data.set("date", date);
    run(() => send("/admin/radio/programacion/editar", data), onEdit);
  }

  function remove() {
    if (!window.confirm(`¿Quitar «${block.title}» de la programación?`)) return;
    run(() => send("/admin/radio/programacion/quitar", { id: block.id }));
  }

  return (
    <div id={`bloque-${block.id}`} className="tl-item scroll-mt-24 py-1.5" data-now={isNow || undefined}>
      <p className={`pt-3 text-right font-mono text-[13px] font-semibold tabular-nums ${past ? "text-muted" : "text-ink"}`}>
        {clock(block.start, true)}
        <span className="block text-[11px] font-normal text-muted">{clock(block.end, true)}</span>
      </p>
      <span className={`tl-dot tl-kind-${block.kind}`} />
      <div className={`ml-6 rounded-2xl border p-3.5 transition ${isNow ? "border-red-300 bg-red-50/60" : "border-line bg-white"} ${past ? "opacity-60" : ""}`}>
        <div className="flex flex-wrap items-start gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <KindTag kind={block.kind} />
              {isNow ? <span className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-red-600">Al aire</span> : null}
              {block.kind === "vivo" && block.bed ? <span className="text-[11px] text-muted">con música de fondo</span> : null}
              {block.inactive ? <span className="text-[11px] font-semibold text-amber-700">Audio desactivado: no sonará</span> : null}
            </div>
            <p className="mt-1.5 truncate text-[15px] font-semibold tracking-[-0.01em]">{block.title}</p>
            <p className="truncate text-[12.5px] text-muted">
              {duration(block.duration)}
              {block.artist ? ` · ${block.artist}` : ""}
              {block.note ? ` · ${block.note}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-1">
            {block.src ? (
              <button type="button" onClick={onPreview} className="rounded-full px-2.5 py-1.5 text-xs font-semibold text-muted transition hover:bg-paper hover:text-ink" aria-label="Escuchar">
                {previewing ? "■ Parar" : "▶ Oír"}
              </button>
            ) : null}
            <button type="button" onClick={onEdit} className="rounded-full px-2.5 py-1.5 text-xs font-semibold text-muted transition hover:bg-paper hover:text-ink">
              {editing ? "Cerrar" : "Editar"}
            </button>
            <button type="button" disabled={pending} onClick={remove} className="rounded-full px-2.5 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-50">
              Quitar
            </button>
          </div>
        </div>
        {editing ? (
          <form onSubmit={save} className="mt-3 grid gap-3 border-t border-line pt-3 sm:grid-cols-2">
            <label className="text-xs font-semibold text-muted">
              Hora de inicio
              <input name="time" type="time" step={1} defaultValue={clock(block.start, true)} className={input} />
            </label>
            <label className="text-xs font-semibold text-muted">
              Título
              <input name="title" defaultValue={block.title} maxLength={160} className={input} />
            </label>
            {block.kind === "vivo" ? (
              <>
                <label className="text-xs font-semibold text-muted">
                  Duración (minutos)
                  <input name="minutes" type="number" min={1} max={360} step={1} defaultValue={Math.round(block.duration / 60)} className={input} />
                </label>
                <label className="flex items-center gap-2 pt-6 text-sm text-ink">
                  <input type="checkbox" name="bed" value="1" defaultChecked={block.bed} /> Música de fondo
                </label>
              </>
            ) : null}
            <label className="text-xs font-semibold text-muted sm:col-span-2">
              Nota interna (opcional)
              <input name="note" defaultValue={block.note ?? ""} maxLength={240} className={input} placeholder="Ej.: leer el anuncio del retiro al terminar" />
            </label>
            <div className="sm:col-span-2">
              <Notice result={result} onClose={() => setResult(null)} />
              <button disabled={pending} className={`${button} mt-2`}>{pending ? "Guardando…" : "Guardar cambios"}</button>
            </div>
          </form>
        ) : result?.error ? (
          <div className="mt-3">
            <Notice result={result} onClose={() => setResult(null)} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function AddPanel({ date, isToday, dayEnd, tracks }: { date: string; isToday: boolean; dayEnd: number | null; tracks: RadioTrack[] }) {
  const [type, setType] = useState<"tracks" | "vivo">("tracks");
  const [mode, setMode] = useState<"end" | "at" | "now">("end");
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<string>("");
  const [picked, setPicked] = useState<RadioTrack[]>([]);
  const { result, setResult, pending, run } = useAction();

  const shown = tracks.filter((track) => (!kind || track.kind === kind) && `${track.title} ${track.artist ?? ""}`.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 60);
  const length = type === "tracks" ? picked.reduce((sum, track) => sum + track.duration, 0) : 0;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    data.set("date", date);
    data.set("mode", mode);
    data.set("type", type);
    if (type === "tracks") picked.forEach((track) => data.append("tracks[]", track.id));
    run(
      () => send("/admin/radio/programacion", data),
      () => setPicked([]),
    );
  }

  return (
    <form onSubmit={submit} className="rounded-[1.6rem] border border-line bg-card p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">Agregar a la programación</p>
      <div className="mt-3 flex rounded-full bg-paper p-1">
        {(
          [
            ["tracks", "Desde la biblioteca"],
            ["vivo", "Bloque en vivo"],
          ] as const
        ).map(([value, label]) => (
          <button key={value} type="button" onClick={() => setType(value)} className={`flex-1 rounded-full px-3 py-2 text-xs font-semibold transition ${type === value ? "bg-ink text-white" : "text-muted"}`}>
            {label}
          </button>
        ))}
      </div>

      {type === "tracks" ? (
        <div className="mt-4">
          {tracks.length === 0 ? (
            <p className="rounded-xl border border-dashed border-line px-4 py-5 text-center text-sm text-muted">
              La biblioteca está vacía. <a href="/admin/radio/biblioteca" className="font-semibold text-ink underline">Sube tus audios</a> primero.
            </p>
          ) : (
            <>
              <div className="flex gap-2">
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar…" className={`${input} !mt-0`} />
                <select value={kind} onChange={(event) => setKind(event.target.value)} className={`${input} !mt-0 !w-auto`}>
                  <option value="">Todo</option>
                  {(["musica", "anuncio", "efecto", "programa"] as const).map((value) => (
                    <option key={value} value={value}>{KIND_LABEL[value]}</option>
                  ))}
                </select>
              </div>
              <ul className="mt-2 max-h-56 divide-y divide-line overflow-y-auto rounded-xl border border-line bg-white">
                {shown.map((track) => (
                  <li key={track.id}>
                    <button type="button" onClick={() => setPicked((list) => [...list, track])} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition hover:bg-paper">
                      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-paper text-xs font-bold">+</span>
                      <span className="min-w-0 flex-1 truncate">
                        {track.title}
                        {track.artist ? <span className="text-muted"> · {track.artist}</span> : null}
                      </span>
                      <span className="shrink-0 font-mono text-[11px] text-muted">{duration(track.duration)}</span>
                    </button>
                  </li>
                ))}
                {shown.length === 0 ? <li className="px-3 py-3 text-sm text-muted">Sin resultados.</li> : null}
              </ul>
              <p className="mt-4 text-xs font-semibold text-muted">En este orden ({picked.length})</p>
              {picked.length ? (
                <ol className="mt-1.5 space-y-1">
                  {picked.map((track, index) => (
                    <li key={`${track.id}-${index}`} className="flex items-center gap-2 rounded-lg bg-paper px-2.5 py-1.5 text-[13px]">
                      <span className="w-5 shrink-0 text-right font-mono text-[11px] text-muted">{index + 1}</span>
                      <KindTag kind={track.kind} />
                      <span className="min-w-0 flex-1 truncate">{track.title}</span>
                      <button type="button" onClick={() => setPicked((list) => list.filter((_, at) => at !== index))} className="px-1 text-muted hover:text-red-700" aria-label="Quitar">
                        ×
                      </button>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="mt-1.5 rounded-lg border border-dashed border-line px-3 py-3 text-[12.5px] text-muted">Toca los audios de arriba para ponerlos en fila.</p>
              )}
              {picked.length ? <p className="mt-2 text-xs text-muted">Duración total: {duration(length)}</p> : null}
            </>
          )}
        </div>
      ) : (
        <div className="mt-4 grid gap-3">
          <label className="text-xs font-semibold text-muted">
            Nombre del bloque
            <input name="title" maxLength={160} placeholder="Ej.: Mañanas con Zoe" className={input} />
          </label>
          <label className="text-xs font-semibold text-muted">
            Duración (minutos)
            <input name="minutes" type="number" min={1} max={360} defaultValue={30} className={input} />
          </label>
          <label className="flex items-start gap-2 text-sm text-ink">
            <input type="checkbox" name="bed" value="1" defaultChecked className="mt-1" />
            <span>
              Música de fondo
              <span className="block text-xs text-muted">Durante el bloque suena la música continua bajita, lista para tu voz.</span>
            </span>
          </label>
        </div>
      )}

      <label className="mt-4 block text-xs font-semibold text-muted">
        Nota interna (opcional)
        <input name="note" maxLength={240} className={input} placeholder="Solo la ve el equipo" />
      </label>

      <fieldset className="mt-4 space-y-2">
        <legend className="text-xs font-semibold text-muted">¿Cuándo suena?</legend>
        <label className="flex items-center gap-2 text-sm">
          <input type="radio" checked={mode === "end"} onChange={() => setMode("end")} />
          {dayEnd ? `Después del último bloque (${clock(dayEnd, true)})` : "Al inicio del día, a esta hora:"}
        </label>
        {mode === "end" && !dayEnd ? <input name="time" type="time" step={1} defaultValue="06:00:00" className={`${input} ml-6 !w-40`} /> : null}
        <label className="flex items-center gap-2 text-sm">
          <input type="radio" checked={mode === "at"} onChange={() => setMode("at")} /> A una hora exacta
        </label>
        {mode === "at" ? <input name="time" type="time" step={1} required className={`${input} ml-6 !w-40`} /> : null}
        {isToday ? (
          <label className="flex items-start gap-2 text-sm">
            <input type="radio" checked={mode === "now"} onChange={() => setMode("now")} className="mt-1" />
            <span>
              Al aire ahora
              <span className="block text-xs text-muted">Corta lo que suena y corre lo que sigue para darle espacio.</span>
            </span>
          </label>
        ) : null}
      </fieldset>

      <div className="mt-4">
        <Notice result={result} onClose={() => setResult(null)} />
      </div>
      <button disabled={pending || (type === "tracks" && picked.length === 0)} className={`${button} mt-3 w-full`}>
        {pending ? "Programando…" : mode === "now" ? "Lanzar al aire" : "Programar"}
      </button>
    </form>
  );
}

function DayTools({ date, today, hasBlocks }: { date: string; today: string; hasBlocks: boolean }) {
  const tomorrow = addDays(date > today ? date : today, 1);
  const [from, setFrom] = useState(tomorrow);
  const [to, setTo] = useState(addDays(tomorrow, 6));
  const [weekdays, setWeekdays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const { result, setResult, pending, run } = useAction();

  const targets = useMemo(() => {
    const list: string[] = [];
    for (let day = from; day <= to && list.length < 32; day = addDays(day, 1)) {
      const weekday = new Date(dayStart(day) + 12 * 3600000).getUTCDay();
      if (day !== date && day >= today && weekdays.includes(weekday)) list.push(day);
    }
    return list;
  }, [from, to, weekdays, date, today]);

  function copy(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const replace = (new FormData(event.currentTarget).get("replace") as string | null) === "1";
    if (replace && !window.confirm(`Se reemplazará la programación de ${targets.length} día(s). ¿Continuar?`)) return;
    run(() => send("/admin/radio/programacion/copiar", { date, targets, replace: replace ? "1" : "0" }));
  }

  function clear() {
    if (!window.confirm("¿Quitar todos los bloques de este día (desde ahora)?")) return;
    run(() => send("/admin/radio/programacion/vaciar", { date }));
  }

  return (
    <form onSubmit={copy} className="rounded-[1.6rem] border border-line bg-card p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">Repetir este día</p>
      <p className="mt-1 text-[12.5px] leading-5 text-muted">Copia toda la programación de este día a otras fechas. Ideal para una parrilla semanal.</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <label className="text-xs font-semibold text-muted">
          Desde
          <input type="date" value={from} min={today} onChange={(event) => setFrom(event.target.value)} className={input} />
        </label>
        <label className="text-xs font-semibold text-muted">
          Hasta
          <input type="date" value={to} min={from} onChange={(event) => setTo(event.target.value)} className={input} />
        </label>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {WEEKDAYS.map((label, index) => {
          const on = weekdays.includes(index);
          return (
            <button
              key={label}
              type="button"
              onClick={() => setWeekdays((list) => (on ? list.filter((value) => value !== index) : [...list, index]))}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${on ? "bg-ink text-white" : "bg-paper text-muted"}`}
            >
              {label}
            </button>
          );
        })}
      </div>
      <label className="mt-3 flex items-center gap-2 text-sm">
        <input type="checkbox" name="replace" value="1" /> Reemplazar lo que ya esté programado
      </label>
      <Notice result={result} onClose={() => setResult(null)} />
      <div className="mt-3 flex flex-wrap gap-2">
        <button disabled={pending || !hasBlocks || targets.length === 0 || targets.length > 31} className={button}>
          Copiar a {targets.length} día{targets.length === 1 ? "" : "s"}
        </button>
        {hasBlocks && date >= today ? (
          <button type="button" disabled={pending} onClick={clear} className={`${ghost} !text-red-700`}>
            Vaciar día
          </button>
        ) : null}
      </div>
    </form>
  );
}
