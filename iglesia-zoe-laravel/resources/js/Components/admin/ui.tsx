import { router } from "@inertiajs/react";
import { useState, useTransition } from "react";
import type { ActionResult } from "@/lib/actions";

export const input = "mt-1.5 w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-ink/40 focus:ring-4 focus:ring-ink/5";
export const button = "inline-flex items-center justify-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-105 disabled:opacity-50";
export const ghost = "inline-flex items-center justify-center gap-2 rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold transition hover:border-ink/30 disabled:opacity-50";

export function PageHeader({ kicker, title, text, aside }: { kicker: string; title: string; text?: string; aside?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4 border-b border-line pb-7 lg:flex-row lg:items-end lg:justify-between">
      <div className="max-w-3xl">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-orange-deep">{kicker}</p>
        <h1 className="mt-3 text-[2.35rem] font-semibold leading-[1.02] tracking-[-0.045em] md:text-5xl">{title}</h1>
        {text && <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">{text}</p>}
      </div>
      {aside}
    </div>
  );
}

export function Panel({ title, text, children, className = "", actions }: { title?: string; text?: string; children: React.ReactNode; className?: string; actions?: React.ReactNode }) {
  return (
    <section className={`rounded-[1.6rem] border border-line bg-card p-5 shadow-[0_18px_50px_-38px_rgba(42,39,36,0.35)] md:p-6 ${className}`}>
      {(title || actions) && (
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            {title && <h2 className="text-lg font-semibold tracking-[-0.025em]">{title}</h2>}
            {text && <p className="mt-1 max-w-2xl text-[13px] leading-5 text-muted">{text}</p>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, note, tone = "bg-white" }: { label: string; value: string | number; note?: string; tone?: string }) {
  return (
    <div className={`rounded-[1.35rem] border border-black/5 p-5 ${tone}`}>
      <p className="text-xs font-semibold text-muted">{label}</p>
      <p className="mt-3 text-[1.7rem] font-semibold leading-none tracking-[-0.04em]">{value}</p>
      {note && <p className="mt-2 text-[11.5px] text-muted">{note}</p>}
    </div>
  );
}

export function Notice({ result, onClose }: { result: ActionResult | null; onClose?: () => void }) {
  if (!result || (!result.error && !result.message)) return null;
  const bad = Boolean(result.error);
  return (
    <div className={`flex items-start justify-between gap-4 rounded-2xl px-4 py-3 text-sm ${bad ? "bg-red-50 text-red-800" : "bg-emerald-50 text-emerald-800"}`}>
      <p>{result.error || result.message}</p>
      {onClose && <button type="button" onClick={onClose} className="opacity-60">×</button>}
    </div>
  );
}

export function useAction() {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();
  function run(task: () => Promise<ActionResult>, after?: (result: ActionResult) => void) {
    start(async () => {
      const next = await task();
      setResult(next);
      if (!next.error) after?.(next);
    });
  }
  return { result, setResult, pending, run };
}

export function PeriodFilter({
  url,
  filters,
  weeks,
  modes,
  extra,
}: {
  url: string;
  filters: Record<string, string | number>;
  weeks: { week: number; label: string }[];
  modes: { key: string; label: string }[];
  extra?: React.ReactNode;
}) {
  const [mode, setMode] = useState(String(filters.periodo));
  const months = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Setiembre", "Octubre", "Noviembre", "Diciembre"];
  const year = Number(filters.anio);
  const years = Array.from({ length: 6 }, (_, index) => new Date().getFullYear() - index);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    router.get(url, data as Record<string, string>, { preserveScroll: true });
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-3 rounded-[1.4rem] border border-line bg-white p-4">
      {modes.length > 1 && (
        <div className="flex rounded-full bg-paper p-1">
          {modes.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setMode(item.key)}
              className={`rounded-full px-4 py-2 text-xs font-semibold transition ${mode === item.key ? "bg-ink text-white" : "text-muted hover:text-ink"}`}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
      <input type="hidden" name="periodo" value={mode} />
      {mode !== "rango" && (
        <label className="text-xs font-semibold text-muted">Año
          <select name="anio" defaultValue={year} className={`${input} min-w-24`}>
            {years.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
      )}
      {mode === "semana" && (
        <label className="min-w-64 flex-1 text-xs font-semibold text-muted">Semana
          <select name="semana" defaultValue={filters.semana} className={input}>
            {weeks.map((item) => <option key={item.week} value={item.week}>{item.label}</option>)}
          </select>
        </label>
      )}
      {mode === "mes" && (
        <label className="text-xs font-semibold text-muted">Mes
          <select name="mes" defaultValue={filters.mes} className={`${input} min-w-36`}>
            {months.map((label, index) => <option key={label} value={index + 1}>{label}</option>)}
          </select>
        </label>
      )}
      {mode === "rango" && (
        <>
          <label className="text-xs font-semibold text-muted">Desde<input type="date" name="desde" defaultValue={String(filters.desde || "")} className={input} /></label>
          <label className="text-xs font-semibold text-muted">Hasta<input type="date" name="hasta" defaultValue={String(filters.hasta || "")} className={input} /></label>
        </>
      )}
      {extra}
      <button className={button}>Ver</button>
    </form>
  );
}
