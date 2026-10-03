import { useMemo, useState } from "react";
import { GAMES_KICKER, Pager, Pill, RecordTools, SearchBar, ThemesPanel, plain, usePages, type AdminTheme } from "@/Components/admin/game-ui";
import { EmptyState, Field, RecordForm } from "@/Components/admin/study-ui";
import { PageHeader, Stat, button, ghost, input } from "@/Components/admin/ui";
import AdminLayout from "@/Layouts/AdminLayout";
import { useSiteUrl } from "@/lib/access";

type Word = { id: string; category_id: string; word: string; description: string | null; reference: string | null; clues: string[]; active: boolean };

type Props = { themes: AdminTheme[]; words: Word[] };

export default function Oculto({ themes, words }: Props) {
  const site = useSiteUrl();
  const [theme, setTheme] = useState("");
  const [state, setState] = useState("");
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const themeName = useMemo(() => Object.fromEntries(themes.map((item) => [item.id, item.name])), [themes]);

  const filtered = useMemo(() => {
    const needle = plain(search.trim());
    return words.filter(
      (item) =>
        (!theme || item.category_id === theme) &&
        (!state || (state === "active" ? item.active : !item.active)) &&
        (!needle || plain([item.word, item.description, item.reference, ...item.clues].join(" ")).includes(needle)),
    );
  }, [words, theme, state, search]);
  const pages = usePages(filtered, 24);

  function filter(apply: () => void) {
    apply();
    pages.setPage(0);
  }

  return (
    <AdminLayout>
      <PageHeader
        kicker={GAMES_KICKER}
        title="El Cristiano Oculto"
        text="Las palabras secretas del juego, agrupadas por tema. Todos reciben la palabra menos los ocultos, que solo ven el tema; las pistas ayudan a quien no sabe qué decir."
        aside={
          <div className="flex flex-wrap gap-2">
            <a href={`${site}/juegos/el-cristiano-oculto`} target="_blank" rel="noreferrer" className={ghost}>Jugar en la web ↗</a>
            {!creating ? <button type="button" onClick={() => setCreating(true)} className={button} disabled={!themes.length}>+ Nueva palabra</button> : null}
          </div>
        }
      />

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <Stat label="Temas" value={themes.length} note={`${themes.filter((item) => item.active).length} visibles`} />
        <Stat label="Palabras" value={words.length} note={`${words.filter((item) => item.active).length} activas en el juego`} />
        <Stat label="Con pistas" value={words.filter((item) => item.clues.length).length} note="Palabras que traen pistas para los jugadores" />
      </div>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
        <div className="lg:sticky lg:top-6">
          <ThemesPanel themes={themes} url="/admin/juegos/cristiano-oculto/tema" countLabel={["palabra", "palabras"]} selected={theme} onSelect={(id) => filter(() => setTheme(id))} total={words.length} />
        </div>

        <div className="grid gap-4">
          {creating ? <WordForm themes={themes} defaultTheme={theme} onDone={() => setCreating(false)} /> : null}

          <SearchBar value={search} onChange={(value) => filter(() => setSearch(value))} placeholder="Palabra, descripción, cita o pista">
            <label className="text-xs font-semibold text-muted">
              Estado
              <select value={state} onChange={(event) => filter(() => setState(event.target.value))} className={`${input} min-w-36`}>
                <option value="">Todas</option>
                <option value="active">Activas</option>
                <option value="hidden">Ocultas</option>
              </select>
            </label>
          </SearchBar>

          {filtered.length === 0 ? (
            <EmptyState>{words.length ? "Ninguna palabra coincide con el filtro." : "Aún no hay palabras. Crea un tema y luego su primera palabra."}</EmptyState>
          ) : (
            <>
              <p className="text-sm text-muted">{filtered.length} {filtered.length === 1 ? "palabra" : "palabras"}{theme ? ` en «${themeName[theme]}»` : ""}</p>
              <ul className="grid gap-3 md:grid-cols-2">
                {pages.slice.map((item) =>
                  open === item.id ? (
                    <li key={item.id} className="md:col-span-2">
                      <WordForm word={item} themes={themes} onDone={() => setOpen(null)} />
                    </li>
                  ) : (
                    <li key={item.id} className={`flex flex-col rounded-[1.4rem] border border-line bg-card p-4 ${item.active ? "" : "opacity-70"}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-lg font-semibold tracking-[-0.02em] text-ink">{item.word}</p>
                          <p className="text-xs text-muted">
                            {themeName[item.category_id] ?? "Sin tema"}
                            {item.reference ? ` · ${item.reference}` : ""}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center">
                          <button type="button" onClick={() => setOpen(item.id)} className="rounded-full px-3 py-1.5 text-sm font-semibold text-accent hover:bg-accent-soft">Editar</button>
                          <RecordTools first last remove={{ url: "/admin/juegos/cristiano-oculto/palabra/eliminar", id: item.id }} confirmText={`¿Eliminar la palabra «${item.word}»?`} />
                        </div>
                      </div>
                      {item.description ? <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted">{item.description}</p> : null}
                      <div className="mt-auto flex flex-wrap gap-1.5 pt-3">
                        {!item.active ? <Pill tone="bg-red-50 text-red-700">Oculta</Pill> : null}
                        {item.clues.map((clue) => <Pill key={clue}>{clue}</Pill>)}
                      </div>
                    </li>
                  ),
                )}
              </ul>
              <Pager {...pages} total={filtered.length} />
            </>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}

function WordForm({ word, themes, defaultTheme, onDone }: { word?: Word; themes: AdminTheme[]; defaultTheme?: string; onDone: () => void }) {
  return (
    <RecordForm
      url="/admin/juegos/cristiano-oculto/palabra"
      id={word?.id}
      deleteUrl={word ? "/admin/juegos/cristiano-oculto/palabra/eliminar" : undefined}
      confirmText={word ? `¿Eliminar la palabra «${word.word}»?` : undefined}
      submitLabel={word ? "Guardar palabra" : "Crear palabra"}
      onDone={onDone}
      onCancel={onDone}
      className="ring-4 ring-accent-soft"
    >
      <h2 className="text-lg font-semibold tracking-[-0.02em]">{word ? `Editar «${word.word}»` : "Nueva palabra"}</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Palabra secreta">
          <input name="word" required minLength={2} maxLength={80} defaultValue={word?.word} autoFocus={!word} className={input} />
        </Field>
        <Field label="Tema">
          <select name="oculto_category_id" required defaultValue={word?.category_id ?? (defaultTheme || themes[0]?.id)} className={input}>
            {themes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </Field>
        <Field label="Cita bíblica">
          <input name="reference" maxLength={120} defaultValue={word?.reference ?? ""} placeholder="Ej. Génesis 6:14" className={input} />
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Descripción (se muestra al final de la partida)">
          <textarea name="description" maxLength={400} rows={4} defaultValue={word?.description ?? ""} className={input} />
        </Field>
        <Field label="Pistas" hint="Una por línea, hasta 8. Palabras cortas que ayudan sin revelar la palabra.">
          <textarea name="clues" rows={4} defaultValue={word?.clues.join("\n") ?? ""} placeholder={"madera\ndiluvio\nanimales"} className={input} />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="active" defaultChecked={word ? word.active : true} className="h-4 w-4 accent-ink" /> Activa en el juego
      </label>
    </RecordForm>
  );
}
