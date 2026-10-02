import { useMemo, useState, type FormEvent } from "react";
import { Notice, button, ghost, input, useAction } from "@/Components/admin/ui";
import { send } from "@/lib/actions";
import { addDays, dayStart } from "@/lib/radio";

const WEEKDAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

/** Copies the whole day (every layer) to other dates, or empties what is left of it. */
export function DayTools({ date, today, hasBlocks }: { date: string; today: string; hasBlocks: boolean }) {
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
    if (!window.confirm("¿Quitar todos los bloques de este día (desde ahora), en todas las pistas?")) return;
    run(() => send("/admin/radio/programacion/vaciar", { date }));
  }

  return (
    <form onSubmit={copy} className="rounded-[1.6rem] border border-line bg-card p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">Repetir este día</p>
      <p className="mt-1 text-[12.5px] leading-5 text-muted">Copia toda la programación de este día (pista principal y capas) a otras fechas. Ideal para una parrilla semanal.</p>
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
