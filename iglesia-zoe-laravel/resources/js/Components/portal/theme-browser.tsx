
import { useMemo, useState } from "react";
import { themeDownloadUrl } from "@/lib/actions";
import type { Theme } from "@/lib/types";

export function ThemeBrowser({ themes }: { themes: Theme[] }) {
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [month, setMonth] = useState("");
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");

  const filtered = useMemo(() => themes.filter((theme) => {
    const date = theme.theme_date;
    if (year && !date.startsWith(year)) return false;
    if (month && date.slice(5, 7) !== month) return false;
    if (query && !theme.title.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  }), [themes, year, month, query]);

  const years = [...new Set(themes.map((theme) => theme.theme_date.slice(0, 4)))];

  return (
    <div>
      <div className="grid gap-3 rounded-[1.5rem] border border-line bg-card p-5 md:grid-cols-4">
        <label className="text-sm">Año
          <select value={year} onChange={(event) => setYear(event.target.value)} className="mt-1 w-full rounded-xl border border-line px-3 py-2">
            <option value="">Todos</option>
            {years.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <label className="text-sm">Mes
          <select value={month} onChange={(event) => setMonth(event.target.value)} className="mt-1 w-full rounded-xl border border-line px-3 py-2">
            <option value="">Todos</option>
            {["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Setiembre","Octubre","Noviembre","Diciembre"].map((name, index) => (
              <option key={name} value={String(index + 1).padStart(2, "0")}>{name}</option>
            ))}
          </select>
        </label>
        <label className="text-sm md:col-span-2">Título
          <input value={query} onChange={(event) => setQuery(event.target.value)} className="mt-1 w-full rounded-xl border border-line px-3 py-2" />
        </label>
      </div>
      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
      <div className="mt-4 overflow-hidden rounded-[1.5rem] border border-line">
        <table className="w-full text-sm">
          <thead className="bg-orange text-left text-white">
            <tr>
              <th className="px-4 py-3">#</th>
              <th className="px-4 py-3">Tema</th>
              <th className="px-4 py-3">Dirigido</th>
              <th className="px-4 py-3">Fecha</th>
              <th className="px-4 py-3">Descargar</th>
            </tr>
          </thead>
          <tbody className="bg-card">
            {filtered.map((theme, index) => (
              <tr key={theme.id} className="border-t border-line">
                <td className="px-4 py-3">{index + 1}</td>
                <td className="px-4 py-3">{theme.title}</td>
                <td className="px-4 py-3">{theme.audience}</td>
                <td className="px-4 py-3">{theme.theme_date}</td>
                <td className="px-4 py-3">
                  {theme.file_path ? (
                    <button
                      className="rounded-lg bg-orange px-3 py-1 text-xs font-medium text-white"
                      onClick={async () => {
                        const result = await themeDownloadUrl(theme.file_path!);
                        if (result.url) window.open(result.url, "_blank");
                        else setError(result.error || "No disponible");
                      }}
                    >PDF</button>
                  ) : <span className="text-muted">Sin archivo</span>}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-muted">No hay temas con ese filtro.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
