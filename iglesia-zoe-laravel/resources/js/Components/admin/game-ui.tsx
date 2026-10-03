import { useState, type ReactNode } from "react";
import { Field, RecordForm } from "@/Components/admin/record-ui";
import { Notice, Panel, input, useAction } from "@/Components/admin/ui";
import { send } from "@/lib/actions";

export const GAMES_KICKER = "Juegos bíblicos";

export type AdminTheme = { id: string; name: string; active: boolean; count: number };

/** Small round button used to move records up or down and to delete them. */
export function IconButton({ label, onClick, disabled, danger = false, children }: { label: string; onClick: () => void; disabled?: boolean; danger?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm transition disabled:opacity-30 ${danger ? "text-red-700 hover:bg-red-50" : "text-muted hover:bg-paper hover:text-ink"}`}
    >
      {children}
    </button>
  );
}

/** Up, down and delete controls for one record, posting to the given endpoints. */
export function RecordTools({
  first,
  last,
  move,
  remove,
  confirmText,
}: {
  first: boolean;
  last: boolean;
  move?: (direction: "up" | "down") => Record<string, string> & { url: string };
  remove?: Record<string, string> & { url: string };
  confirmText?: string;
}) {
  const { result, setResult, pending, run } = useAction();

  function post({ url, ...payload }: Record<string, string> & { url: string }) {
    run(() => send(url, payload));
  }

  return (
    <div className="flex items-center gap-0.5">
      {move ? (
        <>
          <IconButton label="Subir" disabled={pending || first} onClick={() => post(move("up"))}>↑</IconButton>
          <IconButton label="Bajar" disabled={pending || last} onClick={() => post(move("down"))}>↓</IconButton>
        </>
      ) : null}
      {remove ? (
        <IconButton label="Eliminar" danger disabled={pending} onClick={() => window.confirm(confirmText || "¿Eliminar?") && post(remove)}>
          ✕
        </IconButton>
      ) : null}
      {result?.error ? <span className="ml-2 max-w-48"><Notice result={result} onClose={() => setResult(null)} /></span> : null}
    </div>
  );
}

/** Themes of a game: pick one to filter the list, create, rename, hide, order and delete. */
export function ThemesPanel({
  themes,
  url,
  countLabel,
  selected,
  onSelect,
  total,
}: {
  themes: AdminTheme[];
  url: string;
  countLabel: [string, string];
  selected: string;
  onSelect: (id: string) => void;
  total: number;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const plural = (count: number) => `${count} ${count === 1 ? countLabel[0] : countLabel[1]}`;

  return (
    <Panel
      title="Temas"
      text="Elige un tema para ver su contenido. Los temas ocultos no aparecen en el juego."
      actions={editing !== "new" ? <button type="button" onClick={() => setEditing("new")} className="text-sm font-semibold text-accent">+ Tema</button> : null}
    >
      {editing === "new" ? (
        <div className="mb-4">
          <ThemeForm url={url} onDone={() => setEditing(null)} />
        </div>
      ) : null}
      <button
        type="button"
        onClick={() => onSelect("")}
        className={`mb-1 flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition ${selected === "" ? "bg-ink text-white" : "hover:bg-paper"}`}
      >
        <span className="font-semibold">Todos los temas</span>
        <span className={`text-xs ${selected === "" ? "text-white/70" : "text-muted"}`}>{plural(total)}</span>
      </button>
      <ul className="grid gap-1">
        {themes.map((theme, index) =>
          editing === theme.id ? (
            <li key={theme.id}>
              <ThemeForm url={url} theme={theme} onDone={() => setEditing(null)} />
            </li>
          ) : (
            <li key={theme.id} className={`group flex items-center gap-1 rounded-xl pr-1 transition ${selected === theme.id ? "bg-ink text-white" : "hover:bg-paper"}`}>
              <button type="button" onClick={() => onSelect(theme.id)} className="min-w-0 flex-1 px-3 py-2.5 text-left">
                <span className="block truncate text-sm font-semibold">{theme.name}</span>
                <span className={`text-xs ${selected === theme.id ? "text-white/70" : "text-muted"}`}>
                  {plural(theme.count)}
                  {!theme.active ? " · oculto" : ""}
                </span>
              </button>
              <div className={selected === theme.id ? "[&_button]:text-white/80 [&_button:hover]:bg-white/10" : ""}>
                <div className="flex items-center opacity-100 lg:opacity-0 lg:transition lg:group-hover:opacity-100 lg:group-focus-within:opacity-100">
                  <IconButton label="Editar tema" onClick={() => setEditing(theme.id)}>✎</IconButton>
                  <RecordTools
                    first={index === 0}
                    last={index === themes.length - 1}
                    move={(direction) => ({ url: `${url}/orden`, id: theme.id, direction })}
                    remove={{ url: `${url}/eliminar`, id: theme.id }}
                    confirmText={`¿Eliminar el tema «${theme.name}» con ${plural(theme.count)}? No se puede deshacer.`}
                  />
                </div>
              </div>
            </li>
          ),
        )}
      </ul>
    </Panel>
  );
}

function ThemeForm({ url, theme, onDone }: { url: string; theme?: AdminTheme; onDone: () => void }) {
  return (
    <RecordForm url={url} id={theme?.id} submitLabel={theme ? "Guardar" : "Crear tema"} onDone={onDone} onCancel={onDone} className="!p-3.5">
      <Field label="Nombre del tema"><input name="name" required minLength={2} maxLength={80} defaultValue={theme?.name} autoFocus className={input} /></Field>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="active" defaultChecked={theme ? theme.active : true} className="h-4 w-4 accent-ink" /> Visible en el juego
      </label>
    </RecordForm>
  );
}

/** Search box with an optional extra filter beside it. */
export function SearchBar({ value, onChange, placeholder, children }: { value: string; onChange: (value: string) => void; placeholder: string; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-[1.4rem] border border-line bg-white p-3.5">
      <label className="min-w-56 flex-1 text-xs font-semibold text-muted">
        Buscar
        <input type="search" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className={input} />
      </label>
      {children}
    </div>
  );
}

/** Page through a long list without leaving the page. */
export function usePages<T>(items: T[], size = 20) {
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(items.length / size));
  const current = Math.min(page, pages - 1);
  return { slice: items.slice(current * size, current * size + size), page: current, pages, setPage, from: items.length ? current * size + 1 : 0, to: Math.min(items.length, current * size + size) };
}

export function Pager({ page, pages, from, to, total, setPage }: { page: number; pages: number; from: number; to: number; total: number; setPage: (page: number) => void }) {
  if (pages <= 1) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
      <span>{from}–{to} de {total}</span>
      <div className="flex items-center gap-2">
        <button type="button" disabled={page === 0} onClick={() => setPage(page - 1)} className="rounded-full border border-line bg-white px-4 py-1.5 font-semibold text-ink disabled:opacity-40">Anterior</button>
        <span className="px-1">{page + 1} / {pages}</span>
        <button type="button" disabled={page >= pages - 1} onClick={() => setPage(page + 1)} className="rounded-full border border-line bg-white px-4 py-1.5 font-semibold text-ink disabled:opacity-40">Siguiente</button>
      </div>
    </div>
  );
}
