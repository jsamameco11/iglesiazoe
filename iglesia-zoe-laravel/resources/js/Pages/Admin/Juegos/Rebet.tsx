import { useMemo, useState } from "react";
import { GAMES_KICKER, Pager, Pill, RecordTools, SearchBar, ThemesPanel, plain, usePages, type AdminTheme } from "@/Components/admin/game-ui";
import { EmptyState, Field, RecordForm } from "@/Components/admin/study-ui";
import { PageHeader, Stat, button, ghost, input } from "@/Components/admin/ui";
import AdminLayout from "@/Layouts/AdminLayout";
import { useSiteUrl } from "@/lib/access";

type Question = {
  id: string;
  category_id: string;
  difficulty: string;
  question: string;
  options: string[];
  correct: number;
  explanation: string | null;
  reference: string | null;
  time_limit: number;
  active: boolean;
};

type Props = { themes: AdminTheme[]; questions: Question[]; difficulties: Record<string, string> };

const LETTERS = ["A", "B", "C", "D"];
const DIFFICULTY_TONE: Record<string, string> = {
  easy: "bg-emerald-50 text-emerald-800",
  medium: "bg-amber text-[#7a5418]",
  hard: "bg-orange-50 text-orange-800",
  expert: "bg-red-50 text-red-700",
};

export default function Rebet({ themes, questions, difficulties }: Props) {
  const site = useSiteUrl();
  const [theme, setTheme] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const themeName = useMemo(() => Object.fromEntries(themes.map((item) => [item.id, item.name])), [themes]);

  const filtered = useMemo(() => {
    const needle = plain(search.trim());
    return questions.filter(
      (item) =>
        (!theme || item.category_id === theme) &&
        (!difficulty || item.difficulty === difficulty) &&
        (!needle || plain([item.question, item.reference, ...item.options].join(" ")).includes(needle)),
    );
  }, [questions, theme, difficulty, search]);
  const pages = usePages(filtered, 15);

  function filter(apply: () => void) {
    apply();
    pages.setPage(0);
  }

  return (
    <AdminLayout>
      <PageHeader
        kicker={GAMES_KICKER}
        title="REBET"
        text="Trivia bíblica por tiempo: cada pregunta tiene cuatro opciones, una correcta, su dificultad y una explicación con la cita que se muestra al responder."
        aside={
          <div className="flex flex-wrap gap-2">
            <a href={`${site}/juegos/rebet`} target="_blank" rel="noreferrer" className={ghost}>Jugar en la web ↗</a>
            {!creating ? <button type="button" onClick={() => setCreating(true)} className={button} disabled={!themes.length}>+ Nueva pregunta</button> : null}
          </div>
        }
      />

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <Stat label="Temas" value={themes.length} note={`${themes.filter((item) => item.active).length} visibles`} />
        <Stat label="Preguntas" value={questions.length} note={`${questions.filter((item) => item.active).length} activas`} />
        <Stat label="Por dificultad" value={Object.keys(difficulties).map((key) => questions.filter((item) => item.difficulty === key).length).join(" · ")} note={Object.values(difficulties).join(" · ")} />
      </div>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
        <div className="lg:sticky lg:top-6">
          <ThemesPanel themes={themes} url="/admin/juegos/rebet/tema" countLabel={["pregunta", "preguntas"]} selected={theme} onSelect={(id) => filter(() => setTheme(id))} total={questions.length} />
        </div>

        <div className="grid gap-4">
          {creating ? (
            <QuestionForm themes={themes} difficulties={difficulties} defaultTheme={theme} onDone={() => setCreating(false)} />
          ) : null}

          <SearchBar value={search} onChange={(value) => filter(() => setSearch(value))} placeholder="Pregunta, opción o cita">
            <label className="text-xs font-semibold text-muted">
              Dificultad
              <select value={difficulty} onChange={(event) => filter(() => setDifficulty(event.target.value))} className={`${input} min-w-40`}>
                <option value="">Todas</option>
                {Object.entries(difficulties).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </select>
            </label>
          </SearchBar>

          {filtered.length === 0 ? (
            <EmptyState>{questions.length ? "Ninguna pregunta coincide con el filtro." : "Aún no hay preguntas. Crea un tema y luego su primera pregunta."}</EmptyState>
          ) : (
            <>
              <p className="text-sm text-muted">{filtered.length} {filtered.length === 1 ? "pregunta" : "preguntas"}{theme ? ` en «${themeName[theme]}»` : ""}</p>
              <ul className="grid gap-3">
                {pages.slice.map((item) =>
                  open === item.id ? (
                    <li key={item.id}>
                      <QuestionForm question={item} themes={themes} difficulties={difficulties} onDone={() => setOpen(null)} />
                    </li>
                  ) : (
                    <li key={item.id} className="rounded-[1.4rem] border border-line bg-card p-4 md:p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex flex-wrap gap-1.5">
                          <Pill tone={DIFFICULTY_TONE[item.difficulty]}>{difficulties[item.difficulty]}</Pill>
                          <Pill>{themeName[item.category_id] ?? "Sin tema"}</Pill>
                          <Pill>{item.time_limit} s</Pill>
                          {!item.active ? <Pill tone="bg-red-50 text-red-700">Oculta</Pill> : null}
                        </div>
                        <div className="flex items-center gap-1">
                          <button type="button" onClick={() => setOpen(item.id)} className="rounded-full px-3 py-1.5 text-sm font-semibold text-accent hover:bg-accent-soft">Editar</button>
                          <RecordTools first last remove={{ url: "/admin/juegos/rebet/pregunta/eliminar", id: item.id }} confirmText="¿Eliminar esta pregunta? No se puede deshacer." />
                        </div>
                      </div>
                      <p className="mt-3 text-[15px] font-semibold leading-6 text-ink">{item.question}</p>
                      <ol className="mt-3 grid gap-1.5 sm:grid-cols-2">
                        {item.options.map((option, index) => (
                          <li key={index} className={`flex gap-2 rounded-xl px-3 py-2 text-sm ${index === item.correct ? "bg-emerald-50 font-semibold text-emerald-900" : "bg-paper text-muted"}`}>
                            <span className="font-semibold">{LETTERS[index]}</span>
                            <span>{option}</span>
                          </li>
                        ))}
                      </ol>
                      {item.reference ? <p className="mt-3 text-xs font-semibold text-muted">{item.reference}</p> : null}
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

function QuestionForm({
  question,
  themes,
  difficulties,
  defaultTheme,
  onDone,
}: {
  question?: Question;
  themes: AdminTheme[];
  difficulties: Record<string, string>;
  defaultTheme?: string;
  onDone: () => void;
}) {
  return (
    <RecordForm
      url="/admin/juegos/rebet/pregunta"
      id={question?.id}
      deleteUrl={question ? "/admin/juegos/rebet/pregunta/eliminar" : undefined}
      confirmText="¿Eliminar esta pregunta? No se puede deshacer."
      submitLabel={question ? "Guardar pregunta" : "Crear pregunta"}
      onDone={onDone}
      onCancel={onDone}
      className="ring-4 ring-accent-soft"
    >
      <h2 className="text-lg font-semibold tracking-[-0.02em]">{question ? "Editar pregunta" : "Nueva pregunta"}</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Tema">
          <select name="rebet_category_id" required defaultValue={question?.category_id ?? (defaultTheme || themes[0]?.id)} className={input}>
            {themes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </Field>
        <Field label="Dificultad">
          <select name="difficulty" required defaultValue={question?.difficulty ?? "easy"} className={input}>
            {Object.entries(difficulties).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </Field>
        <Field label="Tiempo para responder (segundos)">
          <input name="time_limit" type="number" min={10} max={60} required defaultValue={question?.time_limit ?? 20} className={input} />
        </Field>
      </div>
      <Field label="Pregunta">
        <textarea name="question" required minLength={5} maxLength={400} rows={2} defaultValue={question?.question} className={input} />
      </Field>
      <fieldset className="grid gap-2">
        <legend className="text-xs font-semibold text-muted">Opciones · marca la correcta</legend>
        <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
          {LETTERS.map((letter, index) => (
            <label key={letter} className="flex items-center gap-2.5 rounded-xl border border-line bg-white py-1 pl-3 pr-1 has-[:checked]:border-emerald-400 has-[:checked]:bg-emerald-50/60">
              <input type="radio" name="correct" value={index} required defaultChecked={(question?.correct ?? 0) === index} className="h-4 w-4 accent-emerald-700" aria-label={`La opción ${letter} es la correcta`} />
              <span className="w-4 text-sm font-semibold text-muted">{letter}</span>
              <input name="options[]" required maxLength={200} defaultValue={question?.options[index] ?? ""} placeholder={`Opción ${letter}`} className="min-w-0 flex-1 rounded-lg px-2 py-2 text-sm outline-none" />
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
        <Field label="Explicación (se muestra al responder)">
          <textarea name="explanation" maxLength={800} rows={2} defaultValue={question?.explanation ?? ""} className={input} />
        </Field>
        <Field label="Cita bíblica">
          <input name="reference" maxLength={120} defaultValue={question?.reference ?? ""} placeholder="Ej. Juan 3:16" className={input} />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="active" defaultChecked={question ? question.active : true} className="h-4 w-4 accent-ink" /> Activa en el juego
      </label>
    </RecordForm>
  );
}
