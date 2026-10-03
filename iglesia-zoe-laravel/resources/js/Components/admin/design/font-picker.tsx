import { useEffect, useMemo, useState } from "react";
import { fontHref, fontStack, type FontCategory, type FontOption } from "@/lib/design";

/** Keeps one stylesheet link in the editor's head pointing at `href`. */
export function useStylesheet(id: string, href: string) {
  useEffect(() => {
    let link = document.getElementById(id) as HTMLLinkElement | null;
    if (!href) {
      link?.remove();
      return;
    }
    if (!link) {
      link = Object.assign(document.createElement("link"), { id, rel: "stylesheet" });
      document.head.appendChild(link);
    }
    link.href = href;
  }, [id, href]);
}

/** Loads the regular weight of a whole category once, only when the editor opens it. */
function loadShelf(category: string, fonts: FontOption[]) {
  const id = `zoe-font-shelf-${category}`;
  if (document.getElementById(id)) return;
  const href = fontHref(fonts.filter((font) => font.category === category), "400");
  if (href) document.head.appendChild(Object.assign(document.createElement("link"), { id, rel: "stylesheet", href }));
}

const RESULTS = 40;

/**
 * The font repertoire by category: each family is drawn with a sample in its own letter,
 * so choosing is seeing. `extra` goes above the catalog (shortcuts like "Original").
 */
export function FontPicker({
  fonts,
  categories,
  current,
  caption,
  sample,
  onPick,
  extra,
}: {
  fonts: FontOption[];
  categories: FontCategory[];
  current?: FontOption;
  caption?: string;
  sample: string;
  onPick: (font: FontOption) => void;
  extra?: React.ReactNode;
}) {
  const known = current ? fonts.find((font) => font.name === current.name) : undefined;
  const [open, setOpen] = useState(false);
  const [shelf, setShelf] = useState(known?.category ?? categories[0]?.key ?? "");
  const [query, setQuery] = useState("");
  const search = query.trim().toLowerCase();
  const list = useMemo(
    () => (search ? fonts.filter((font) => font.name.toLowerCase().includes(search)).slice(0, RESULTS) : fonts.filter((font) => font.category === shelf)),
    [fonts, search, shelf],
  );
  const category = categories.find((item) => item.key === shelf);

  useEffect(() => {
    if (!open) return;
    new Set(list.map((font) => font.category ?? "")).forEach((key) => key && loadShelf(key, fonts));
  }, [open, list, fonts]);

  return (
    <div className="rounded-2xl border border-line bg-white">
      <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} className="flex w-full items-center justify-between gap-3 px-3.5 py-3 text-left">
        <span className="min-w-0">
          <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">{caption ?? categories.find((item) => item.key === known?.category)?.label ?? "Tipografía"}</span>
          <span className="mt-0.5 block truncate text-lg leading-tight text-ink" style={current ? { fontFamily: fontStack(current) } : undefined}>{current?.name ?? "Original de la página"}</span>
        </span>
        <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition ${open ? "bg-ink text-white" : "border border-line text-ink hover:border-ink/30"}`}>{open ? "Cerrar" : "Cambiar"}</span>
      </button>

      {open && (
        <div className="space-y-3 border-t border-line p-3">
          {extra}
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={`Buscar entre ${fonts.length} tipografías…`}
            className="w-full rounded-xl border border-line bg-paper/60 px-3 py-2 text-sm outline-none focus:border-ink/40"
          />
          {!search && (
            <>
              <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Categorías de tipografías">
                {categories.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    role="tab"
                    aria-selected={item.key === shelf}
                    onClick={() => setShelf(item.key)}
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${item.key === shelf ? "bg-ink text-white" : "border border-line bg-white text-muted hover:border-ink/30 hover:text-ink"}`}
                  >
                    {item.label} <span className="opacity-60">{item.count}</span>
                  </button>
                ))}
              </div>
              {category && <p className="text-[11px] leading-4 text-muted">{category.text}</p>}
            </>
          )}
          <ul className="max-h-80 space-y-1.5 overflow-y-auto pr-1">
            {list.map((font) => {
              const active = font.name === current?.name;
              return (
                <li key={font.name}>
                  <button
                    type="button"
                    onClick={() => onPick(font)}
                    className={`w-full rounded-xl border px-3 py-2 text-left transition ${active ? "border-ink bg-ink/[0.04]" : "border-line hover:border-ink/30 hover:bg-paper/50"}`}
                  >
                    <span className="flex items-center justify-between gap-2 text-[11px] text-muted">
                      <span className="truncate">
                        {font.name}
                        {font.local ? " · incluida en la web" : ""}
                        {search ? ` · ${categories.find((item) => item.key === font.category)?.label ?? ""}` : ""}
                      </span>
                      {active && <span className="shrink-0 font-semibold text-accent">✓ En uso</span>}
                    </span>
                    <span className="block truncate text-xl leading-snug text-ink" style={{ fontFamily: fontStack(font) }}>{sample}</span>
                  </button>
                </li>
              );
            })}
            {!list.length && <li className="rounded-xl border border-dashed border-line px-3 py-4 text-center text-xs text-muted">Ninguna tipografía se llama así. Prueba con otra palabra.</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
