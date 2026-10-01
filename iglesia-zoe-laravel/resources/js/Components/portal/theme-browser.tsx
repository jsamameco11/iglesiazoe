import { useMemo, useState } from "react";
import { ghost, input } from "@/Components/admin/ui";
import type { Theme } from "@/lib/types";

const MONTHS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Setiembre", "Octubre", "Noviembre", "Diciembre"];

function shortDate(value: string) {
  const [year, month, day] = value.split("-");
  return `${day} ${MONTHS[Number(month) - 1]?.slice(0, 3) ?? ""} ${year}`;
}

export function ThemeBrowser({ themes }: { themes: Theme[] }) {
  const years = useMemo(() => [...new Set(themes.map((theme) => theme.theme_date.slice(0, 4)))], [themes]);
  const currentYear = String(new Date().getFullYear());
  const [year, setYear] = useState(years.includes(currentYear) ? currentYear : "");
  const [month, setMonth] = useState("");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return themes.filter((theme) => {
      if (year && !theme.theme_date.startsWith(year)) return false;
      if (month && theme.theme_date.slice(5, 7) !== month) return false;
      return !needle || theme.title.toLowerCase().includes(needle) || theme.audience.toLowerCase().includes(needle);
    });
  }, [themes, year, month, query]);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 rounded-[1.4rem] border border-line bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-xs font-semibold text-muted">Año
          <select value={year} onChange={(event) => setYear(event.target.value)} className={input}>
            <option value="">Todos</option>
            {years.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <label className="text-xs font-semibold text-muted">Mes
          <select value={month} onChange={(event) => setMonth(event.target.value)} className={input}>
            <option value="">Todos</option>
            {MONTHS.map((name, index) => <option key={name} value={String(index + 1).padStart(2, "0")}>{name}</option>)}
          </select>
        </label>
        <label className="text-xs font-semibold text-muted sm:col-span-2">Buscar
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Título o público" className={input} />
        </label>
      </div>

      <p className="px-1 text-xs text-muted">{filtered.length} {filtered.length === 1 ? "tema" : "temas"}</p>

      {filtered.length === 0 ? (
        <p className="rounded-[1.4rem] border border-line bg-card px-4 py-12 text-center text-sm text-muted">No hay temas con ese filtro.</p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
          {filtered.map((theme) => (
            <li key={theme.id} className="flex flex-col justify-between gap-4 rounded-[1.4rem] border border-line bg-card p-5">
              <div>
                <div className="flex items-center justify-between gap-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
                  <span>{shortDate(theme.theme_date)}</span>
                  {theme.file_type && <span className="rounded-full bg-orange/10 px-2 py-0.5 text-orange-deep">{theme.file_type}</span>}
                </div>
                <p className="mt-3 text-lg font-semibold leading-snug tracking-[-0.02em]">{theme.title}</p>
                <p className="mt-1 text-sm text-muted">Para: {theme.audience}</p>
              </div>
              {theme.file_url ? (
                <div className="flex flex-wrap gap-2">
                  <a href={theme.file_url} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110">Abrir</a>
                  {theme.download_url && <a href={theme.download_url} className={ghost}>Descargar</a>}
                </div>
              ) : (
                <span className="text-sm text-muted">Sin archivo adjunto</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
