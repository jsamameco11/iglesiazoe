import { router } from "@inertiajs/react";
import { useState } from "react";
import { GAMES_KICKER, IconButton, Pill, RecordTools } from "@/Components/admin/game-ui";
import { EmptyState, Field, RecordForm } from "@/Components/admin/study-ui";
import { PageHeader, Panel, Stat, ghost, input } from "@/Components/admin/ui";
import AdminLayout from "@/Layouts/AdminLayout";
import { useSiteUrl } from "@/lib/access";
import type { ActionResult } from "@/lib/actions";

type Exercise = { id: string; kind: "choice" | "truefalse"; prompt: string; passage_reference: string | null; passage_text: string | null; options: string[]; answer: number };
type Lesson = { id: string; title: string; xp: number; published: boolean; exercises: Exercise[] };
type Unit = { id: string; title: string; description: string | null; lessons: Lesson[] };
type Path = { id: string; slug: string; title: string; description: string | null; published: boolean; units: number };

type Props = { paths: Path[]; selected: { id: string; units: Unit[] } | null };

const URL = "/admin/juegos/lingobible";

const tools = (type: string, id: string) => ({
  move: (direction: "up" | "down") => ({ url: `${URL}/orden`, type, id, direction }),
  remove: { url: `${URL}/eliminar`, type, id },
});

function openPath(id: string) {
  router.get(URL, { ruta: id }, { preserveScroll: true });
}

export default function Lingobible({ paths, selected }: Props) {
  const site = useSiteUrl();
  const [creating, setCreating] = useState(false);
  const path = paths.find((item) => item.id === selected?.id);
  const lessons = selected?.units.flatMap((unit) => unit.lessons) ?? [];

  return (
    <AdminLayout>
      <PageHeader
        kicker={GAMES_KICKER}
        title="LINGOBIBLE"
        text="Rutas de aprendizaje con unidades y lecciones cortas. Cada lección tiene ejercicios de opción múltiple o de verdadero y falso, con el pasaje bíblico que se lee antes de responder."
        aside={<a href={`${site}/juegos/lingobible`} target="_blank" rel="noreferrer" className={ghost}>Jugar en la web ↗</a>}
      />

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
        <div className="lg:sticky lg:top-6">
          <Panel
            title="Rutas"
            text="Elige una ruta para editar sus unidades, lecciones y ejercicios."
            actions={!creating ? <button type="button" onClick={() => setCreating(true)} className="text-sm font-semibold text-accent">+ Ruta</button> : null}
          >
            {creating ? (
              <div className="mb-4">
                <PathForm
                  onDone={(result) => {
                    setCreating(false);
                    if (typeof result.id === "string") openPath(result.id);
                  }}
                  onCancel={() => setCreating(false)}
                />
              </div>
            ) : null}
            {paths.length === 0 ? <p className="text-sm text-muted">Aún no hay rutas.</p> : null}
            <ul className="grid gap-1">
              {paths.map((item, index) => {
                const active = item.id === selected?.id;
                return (
                  <li key={item.id} className={`group flex items-center gap-1 rounded-xl pr-1 transition ${active ? "bg-ink text-white" : "hover:bg-paper"}`}>
                    <button type="button" onClick={() => openPath(item.id)} className="min-w-0 flex-1 px-3 py-2.5 text-left">
                      <span className="block truncate text-sm font-semibold">{item.title}</span>
                      <span className={`text-xs ${active ? "text-white/70" : "text-muted"}`}>
                        {item.units} {item.units === 1 ? "unidad" : "unidades"}
                        {!item.published ? " · borrador" : ""}
                      </span>
                    </button>
                    <div className={`flex items-center lg:opacity-0 lg:transition lg:group-hover:opacity-100 lg:group-focus-within:opacity-100 ${active ? "[&_button]:text-white/80 [&_button:hover]:bg-white/10" : ""}`}>
                      <RecordTools first={index === 0} last={index === paths.length - 1} move={tools("path", item.id).move} />
                    </div>
                  </li>
                );
              })}
            </ul>
          </Panel>
        </div>

        {path && selected ? (
          <div className="grid gap-5">
            <div className="grid gap-3 sm:grid-cols-3">
              <Stat label="Unidades" value={selected.units.length} />
              <Stat label="Lecciones" value={lessons.length} note={`${lessons.filter((item) => item.published).length} publicadas`} />
              <Stat label="Ejercicios" value={lessons.reduce((sum, item) => sum + item.exercises.length, 0)} />
            </div>

            <PathCard key={path.id} path={path} site={site} />

            {selected.units.length === 0 ? <EmptyState>Esta ruta aún no tiene unidades. Crea la primera abajo.</EmptyState> : null}
            {selected.units.map((unit, index) => (
              <UnitCard key={unit.id} unit={unit} pathId={path.id} number={index + 1} first={index === 0} last={index === selected.units.length - 1} />
            ))}
            <NewUnit pathId={path.id} />
          </div>
        ) : (
          <EmptyState>Crea una ruta para empezar.</EmptyState>
        )}
      </div>
    </AdminLayout>
  );
}

function PathForm({ path, onDone, onCancel }: { path?: Path; onDone?: (result: ActionResult) => void; onCancel?: () => void }) {
  return (
    <RecordForm url={`${URL}/ruta`} id={path?.id} submitLabel={path ? "Guardar ruta" : "Crear ruta"} onDone={onDone} onCancel={onCancel} className={path ? "" : "!p-3.5"}>
      <Field label="Título de la ruta"><input name="title" required minLength={2} maxLength={120} defaultValue={path?.title} autoFocus={!path} className={input} /></Field>
      <Field label="Descripción"><textarea name="description" maxLength={400} rows={2} defaultValue={path?.description ?? ""} className={input} /></Field>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="published" defaultChecked={path ? path.published : true} className="h-4 w-4 accent-ink" /> Publicada en la web
      </label>
    </RecordForm>
  );
}

function PathCard({ path, site }: { path: Path; site: string }) {
  const [editing, setEditing] = useState(false);
  if (editing) return <PathForm path={path} onDone={() => setEditing(false)} onCancel={() => setEditing(false)} />;
  return (
    <section className="flex flex-wrap items-start justify-between gap-4 rounded-[1.6rem] border border-line bg-card p-5 md:p-6">
      <div className="max-w-2xl">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-2xl font-semibold tracking-[-0.03em]">{path.title}</h2>
          {!path.published ? <Pill tone="bg-amber text-[#7a5418]">Borrador</Pill> : null}
        </div>
        {path.description ? <p className="mt-2 text-sm leading-6 text-muted">{path.description}</p> : null}
        <a href={`${site}/juegos/lingobible/${path.slug}`} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs font-semibold text-muted hover:text-accent">/juegos/lingobible/{path.slug} ↗</a>
      </div>
      <div className="flex items-center gap-1">
        <button type="button" onClick={() => setEditing(true)} className={ghost}>Editar ruta</button>
        <RecordTools first last remove={tools("path", path.id).remove} confirmText={`¿Eliminar la ruta «${path.title}» con todas sus unidades, lecciones y ejercicios? No se puede deshacer.`} />
      </div>
    </section>
  );
}

function UnitForm({ unit, pathId, onDone }: { unit?: Unit; pathId: string; onDone: () => void }) {
  return (
    <RecordForm url={`${URL}/unidad`} id={unit?.id} submitLabel={unit ? "Guardar unidad" : "Crear unidad"} onDone={onDone} onCancel={onDone}>
      <input type="hidden" name="lingo_path_id" value={pathId} />
      <div className="grid gap-3 sm:grid-cols-[1fr_2fr]">
        <Field label="Título de la unidad"><input name="title" required minLength={2} maxLength={120} defaultValue={unit?.title} autoFocus className={input} /></Field>
        <Field label="Descripción"><input name="description" maxLength={400} defaultValue={unit?.description ?? ""} className={input} /></Field>
      </div>
    </RecordForm>
  );
}

function NewUnit({ pathId }: { pathId: string }) {
  const [open, setOpen] = useState(false);
  return open ? (
    <UnitForm pathId={pathId} onDone={() => setOpen(false)} />
  ) : (
    <button type="button" onClick={() => setOpen(true)} className="rounded-[1.4rem] border border-dashed border-line px-5 py-5 text-sm font-semibold text-muted transition hover:border-ink/30 hover:text-ink">
      + Nueva unidad
    </button>
  );
}

function UnitCard({ unit, pathId, number, first, last }: { unit: Unit; pathId: string; number: number; first: boolean; last: boolean }) {
  const [editing, setEditing] = useState(false);
  const [openLesson, setOpenLesson] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <section className="rounded-[1.6rem] border border-line bg-card p-5 shadow-[0_18px_50px_-38px_rgba(42,39,36,0.35)] md:p-6">
      {editing ? (
        <UnitForm unit={unit} pathId={pathId} onDone={() => setEditing(false)} />
      ) : (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-ink text-sm font-semibold text-white">{number}</span>
            <div>
              <h3 className="text-lg font-semibold tracking-[-0.02em]">{unit.title}</h3>
              {unit.description ? <p className="text-sm text-muted">{unit.description}</p> : null}
            </div>
          </div>
          <div className="flex items-center gap-0.5">
            <IconButton label="Editar unidad" onClick={() => setEditing(true)}>✎</IconButton>
            <RecordTools first={first} last={last} {...tools("unit", unit.id)} confirmText={`¿Eliminar la unidad «${unit.title}» con sus lecciones y ejercicios?`} />
          </div>
        </div>
      )}

      <ul className="mt-4 grid gap-2">
        {unit.lessons.map((lesson, index) => (
          <li key={lesson.id} className="rounded-2xl border border-line bg-white">
            <div className="flex flex-wrap items-center gap-2 px-3 py-2.5">
              <button type="button" onClick={() => setOpenLesson(openLesson === lesson.id ? null : lesson.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-expanded={openLesson === lesson.id}>
                <span className={`text-xs text-muted transition ${openLesson === lesson.id ? "rotate-90" : ""}`}>▶</span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">Lección {index + 1} · {lesson.title}</span>
                  <span className="text-xs text-muted">{lesson.exercises.length} {lesson.exercises.length === 1 ? "ejercicio" : "ejercicios"} · {lesson.xp} XP</span>
                </span>
              </button>
              {!lesson.published ? <Pill tone="bg-amber text-[#7a5418]">Borrador</Pill> : null}
              <RecordTools first={index === 0} last={index === unit.lessons.length - 1} {...tools("lesson", lesson.id)} confirmText={`¿Eliminar la lección «${lesson.title}» con sus ejercicios?`} />
            </div>
            {openLesson === lesson.id ? <LessonEditor lesson={lesson} unitId={unit.id} /> : null}
          </li>
        ))}
      </ul>

      <div className="mt-3">
        {creating ? (
          <LessonForm unitId={unit.id} onDone={() => setCreating(false)} />
        ) : (
          <button type="button" onClick={() => setCreating(true)} className="text-sm font-semibold text-accent">+ Lección</button>
        )}
      </div>
    </section>
  );
}

function LessonForm({ lesson, unitId, onDone }: { lesson?: Lesson; unitId: string; onDone?: () => void }) {
  return (
    <RecordForm url={`${URL}/leccion`} id={lesson?.id} submitLabel={lesson ? "Guardar lección" : "Crear lección"} onDone={onDone} onCancel={lesson ? undefined : onDone} className={lesson ? "!rounded-none !border-0 !bg-transparent !p-0" : ""}>
      <input type="hidden" name="lingo_unit_id" value={unitId} />
      <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
        <Field label="Título de la lección"><input name="title" required minLength={2} maxLength={120} defaultValue={lesson?.title} autoFocus={!lesson} className={input} /></Field>
        <Field label="XP al completarla"><input name="xp" type="number" min={5} max={100} required defaultValue={lesson?.xp ?? 10} className={input} /></Field>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="published" defaultChecked={lesson ? lesson.published : true} className="h-4 w-4 accent-ink" /> Publicada en la web
      </label>
    </RecordForm>
  );
}

function LessonEditor({ lesson, unitId }: { lesson: Lesson; unitId: string }) {
  const [open, setOpen] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <div className="grid gap-4 border-t border-line p-4">
      <LessonForm lesson={lesson} unitId={unitId} />
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Ejercicios</p>
        {lesson.exercises.length === 0 ? <p className="mt-2 text-sm text-muted">Esta lección aún no tiene ejercicios.</p> : null}
        <ol className="mt-2 grid gap-2">
          {lesson.exercises.map((exercise, index) =>
            open === exercise.id ? (
              <li key={exercise.id}>
                <ExerciseForm exercise={exercise} lessonId={lesson.id} onDone={() => setOpen(null)} />
              </li>
            ) : (
              <li key={exercise.id} className="flex items-start gap-2 rounded-xl bg-paper px-3 py-2.5">
                <span className="mt-0.5 text-xs font-semibold text-muted">{index + 1}</span>
                <button type="button" onClick={() => setOpen(exercise.id)} className="min-w-0 flex-1 text-left">
                  <span className="block text-sm font-medium text-ink">{exercise.prompt}</span>
                  <span className="text-xs text-muted">
                    {exercise.kind === "truefalse" ? (exercise.answer === 1 ? "Verdadero" : "Falso") : `Correcta: ${exercise.options[exercise.answer] ?? "—"}`}
                    {exercise.passage_reference ? ` · ${exercise.passage_reference}` : ""}
                  </span>
                </button>
                <RecordTools first={index === 0} last={index === lesson.exercises.length - 1} {...tools("exercise", exercise.id)} confirmText="¿Eliminar este ejercicio?" />
              </li>
            ),
          )}
        </ol>
        <div className="mt-3">
          {creating ? (
            <ExerciseForm lessonId={lesson.id} onDone={() => setCreating(false)} />
          ) : (
            <button type="button" onClick={() => setCreating(true)} className={ghost}>+ Ejercicio</button>
          )}
        </div>
      </div>
    </div>
  );
}

function ExerciseForm({ exercise, lessonId, onDone }: { exercise?: Exercise; lessonId: string; onDone: () => void }) {
  const [kind, setKind] = useState<Exercise["kind"]>(exercise?.kind ?? "choice");
  const [options, setOptions] = useState<string[]>(exercise?.kind === "choice" && exercise.options.length ? exercise.options : ["", "", "", ""]);
  const [answer, setAnswer] = useState(exercise?.answer ?? (kind === "truefalse" ? 1 : 0));

  function removeOption(index: number) {
    setOptions((list) => list.filter((_, at) => at !== index));
    setAnswer((current) => (current === index ? 0 : current > index ? current - 1 : current));
  }

  return (
    <RecordForm url={`${URL}/ejercicio`} id={exercise?.id} submitLabel={exercise ? "Guardar ejercicio" : "Crear ejercicio"} onDone={onDone} onCancel={onDone} className="ring-4 ring-accent-soft">
      <input type="hidden" name="lingo_lesson_id" value={lessonId} />
      <div className="grid gap-3 sm:grid-cols-[1fr_2fr]">
        <Field label="Tipo">
          <select
            name="kind"
            value={kind}
            onChange={(event) => {
              const next = event.target.value as Exercise["kind"];
              setKind(next);
              setAnswer(next === "truefalse" ? 1 : 0);
            }}
            className={input}
          >
            <option value="choice">Opción múltiple</option>
            <option value="truefalse">Verdadero o falso</option>
          </select>
        </Field>
        <Field label="Pregunta o afirmación"><textarea name="prompt" required minLength={5} maxLength={500} rows={2} defaultValue={exercise?.prompt} className={input} /></Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-[1fr_2fr]">
        <Field label="Cita del pasaje (opcional)"><input name="passage_reference" maxLength={120} defaultValue={exercise?.passage_reference ?? ""} placeholder="Ej. Salmo 23:1" className={input} /></Field>
        <Field label="Texto del pasaje (opcional)"><textarea name="passage_text" maxLength={1500} rows={2} defaultValue={exercise?.passage_text ?? ""} className={input} /></Field>
      </div>

      <input type="hidden" name="answer" value={answer} />
      {kind === "truefalse" ? (
        <fieldset>
          <legend className="text-xs font-semibold text-muted">Respuesta correcta</legend>
          <div className="mt-1.5 flex gap-2">
            {[
              [1, "Verdadero"],
              [0, "Falso"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setAnswer(value as number)}
                className={`rounded-full border px-5 py-2 text-sm font-semibold transition ${answer === value ? "border-emerald-500 bg-emerald-50 text-emerald-900" : "border-line bg-white text-muted"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </fieldset>
      ) : (
        <fieldset className="grid gap-2">
          <legend className="text-xs font-semibold text-muted">Opciones · marca la correcta (de 2 a 6)</legend>
          <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
            {options.map((option, index) => (
              <div key={index} className={`flex items-center gap-2 rounded-xl border bg-white py-1 pl-3 pr-1 ${answer === index ? "border-emerald-400 bg-emerald-50/60" : "border-line"}`}>
                <input type="radio" checked={answer === index} onChange={() => setAnswer(index)} className="h-4 w-4 accent-emerald-700" aria-label={`La opción ${index + 1} es la correcta`} />
                <input
                  name="options[]"
                  required
                  maxLength={200}
                  value={option}
                  onChange={(event) => setOptions((list) => list.map((item, at) => (at === index ? event.target.value : item)))}
                  placeholder={`Opción ${index + 1}`}
                  className="min-w-0 flex-1 rounded-lg bg-transparent px-2 py-2 text-sm outline-none"
                />
                {options.length > 2 ? <IconButton label="Quitar opción" onClick={() => removeOption(index)}>✕</IconButton> : null}
              </div>
            ))}
          </div>
          {options.length < 6 ? (
            <button type="button" onClick={() => setOptions((list) => [...list, ""])} className="justify-self-start text-sm font-semibold text-accent">+ Opción</button>
          ) : null}
        </fieldset>
      )}
      {!exercise ? <p className="text-[11px] text-muted">Se agrega al final de la lección; puedes moverlo después con las flechas.</p> : null}
    </RecordForm>
  );
}
