import { Link } from "@inertiajs/react";
import { useState, type FormEvent } from "react";
import { EmptyState, Field, Pill } from "@/Components/admin/record-ui";
import { STUDY_KICKER } from "@/Components/admin/study-ui";
import { Notice, PageHeader, Panel, button, ghost, input, useAction } from "@/Components/admin/ui";
import AdminLayout from "@/Layouts/AdminLayout";
import { can, usePanelUser } from "@/lib/access";
import { send } from "@/lib/actions";
import { classLine, scheduleLabel, type StudyLevel } from "@/lib/studies";

type Assessment = { id: string; title: string; week: number | null };
type Row = { id: string; name: string; username: string; status: string; scores: Record<string, number> };

type Props = {
  levels: { id: string; name: string; active: boolean }[];
  level: (StudyLevel & { weeks: number }) | null;
  assessments: Assessment[];
  students: Row[];
  maxScore: number;
};

function average(values: (number | null)[]) {
  const list = values.filter((value): value is number => value !== null && !Number.isNaN(value));
  return list.length ? Math.round((list.reduce((sum, value) => sum + value, 0) / list.length) * 10) / 10 : null;
}

function parse(value: string) {
  const clean = value.trim().replace(",", ".");
  return clean === "" ? null : Number(clean);
}

export default function Notas({ levels, level, assessments, students, maxScore }: Props) {
  const manages = can(usePanelUser(), "studies.students");
  return (
    <AdminLayout>
      <PageHeader
        kicker={STUDY_KICKER}
        title="Notas"
        text={`Elige el nivel, arma sus evaluaciones y escribe las notas de 0 a ${maxScore}. Cada estudiante ve sus notas y su promedio en su aula apenas guardas.`}
      />

      <div className="mt-6 flex flex-wrap gap-2">
        {levels.map((item) => (
          <Link
            key={item.id}
            href={`/admin/estudios/notas?nivel=${item.id}`}
            preserveScroll
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${level?.id === item.id ? "bg-ink text-white" : "border border-line bg-white text-muted hover:text-ink"} ${item.active ? "" : "opacity-60"}`}
          >
            {item.name}
          </Link>
        ))}
      </div>

      {level ? (
        <>
          <p className="mt-4 text-sm text-muted">
            {scheduleLabel(level.schedule)} · {classLine(level.schedule)} · Aprueba con {level.pass_score}
          </p>
          <Assessments level={level} assessments={assessments} />
          {students.length && assessments.length ? (
            <Gradebook key={level.id} level={level} assessments={assessments} students={students} maxScore={maxScore} />
          ) : students.length ? null : (
            <div className="mt-6">
              <EmptyState>
                Aún no hay estudiantes en {level.name}.{" "}
                {manages ? (
                  <>
                    Ubícalos en este nivel desde{" "}
                    <Link href="/admin/estudios/estudiantes" className="font-semibold text-ink underline underline-offset-4">Estudiantes</Link>.
                  </>
                ) : (
                  "Pide a quien administra los estudiantes que los ubique en este nivel."
                )}
              </EmptyState>
            </div>
          )}
        </>
      ) : (
        <div className="mt-6"><EmptyState>{manages ? "Primero crea un nivel en Niveles y horarios." : "Todavía no hay niveles creados."}</EmptyState></div>
      )}
    </AdminLayout>
  );
}

function Assessments({ level, assessments }: { level: StudyLevel & { weeks: number }; assessments: Assessment[] }) {
  const { result, setResult, pending, run } = useAction();
  const [editing, setEditing] = useState<string | null>(null);

  function submit(event: FormEvent<HTMLFormElement>, id?: string) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    data.set("level_id", level.id);
    if (id) data.set("id", id);
    run(() => send("/admin/estudios/notas/evaluacion", data), () => {
      form.reset();
      setEditing(null);
    });
  }

  function remove(assessment: Assessment) {
    if (!window.confirm(`¿Eliminar «${assessment.title}»? Se borran también las notas de esa evaluación.`)) return;
    run(() => send("/admin/estudios/notas/evaluacion/eliminar", { id: assessment.id }));
  }

  return (
    <Panel className="mt-6" title={`Evaluaciones de ${level.name}`} text="Exámenes, tareas, participación… Cada una es una columna de notas. El promedio es el de las notas registradas.">
      <div className="flex flex-wrap gap-2">
        {assessments.map((assessment) =>
          editing === assessment.id ? (
            <form key={assessment.id} onSubmit={(event) => submit(event, assessment.id)} className="flex flex-wrap items-end gap-2 rounded-2xl border border-line bg-white p-2">
              <input name="title" required maxLength={80} defaultValue={assessment.title} aria-label="Nombre" className={`${input} mt-0 w-44`} />
              <input name="week" type="number" min={1} max={level.weeks} defaultValue={assessment.week ?? ""} aria-label="Semana" placeholder="Sem." className={`${input} mt-0 w-20`} />
              <button disabled={pending} className={button}>Guardar</button>
              <button type="button" onClick={() => setEditing(null)} className={ghost}>×</button>
            </form>
          ) : (
            <span key={assessment.id} className="inline-flex items-center gap-1 rounded-full border border-line bg-white py-1 pl-3.5 pr-1 text-sm">
              <button type="button" onClick={() => setEditing(assessment.id)} className="font-semibold">
                {assessment.title}
                {assessment.week ? <span className="ml-1 font-normal text-muted">· sem. {assessment.week}</span> : null}
              </button>
              <button type="button" onClick={() => remove(assessment)} aria-label={`Eliminar ${assessment.title}`} className="grid h-7 w-7 place-items-center rounded-full text-muted hover:bg-red-50 hover:text-red-700">×</button>
            </span>
          ),
        )}
      </div>
      <form onSubmit={(event) => submit(event)} className="mt-4 flex flex-wrap items-end gap-2 border-t border-line pt-4">
        <Field label="Nueva evaluación"><input name="title" required maxLength={80} placeholder="Ej. Examen final" className={`${input} w-56`} /></Field>
        <Field label="Semana (opcional)"><input name="week" type="number" min={1} max={level.weeks} className={`${input} w-28`} /></Field>
        <button disabled={pending} className={button}>+ Agregar</button>
      </form>
      <div className="mt-3"><Notice result={result} onClose={() => setResult(null)} /></div>
    </Panel>
  );
}

function Gradebook({ level, assessments, students, maxScore }: { level: StudyLevel; assessments: Assessment[]; students: Row[]; maxScore: number }) {
  const [values, setValues] = useState<Record<string, Record<string, string>>>(() =>
    Object.fromEntries(students.map((student) => [student.id, Object.fromEntries(assessments.map((assessment) => [assessment.id, student.scores[assessment.id] != null ? String(student.scores[assessment.id]) : ""]))])),
  );
  const [dirty, setDirty] = useState(false);
  const { result, setResult, pending, run } = useAction();

  function change(studentId: string, assessmentId: string, value: string) {
    setValues((current) => ({ ...current, [studentId]: { ...current[studentId], [assessmentId]: value } }));
    setDirty(true);
  }

  function save() {
    const data = new FormData();
    data.set("level_id", level.id);
    Object.entries(values).forEach(([studentId, cells]) => Object.entries(cells).forEach(([assessmentId, value]) => data.set(`scores[${studentId}][${assessmentId}]`, value)));
    run(() => send("/admin/estudios/notas", data), () => setDirty(false));
  }

  return (
    <Panel
      className="mt-6"
      title="Registro de notas"
      text={`Escribe la nota y presiona «Guardar notas». Deja la casilla vacía si aún no hay nota. En rojo, por debajo de ${level.pass_score}.`}
      actions={<button type="button" disabled={pending || !dirty} onClick={save} className={button}>{pending ? "Guardando…" : dirty ? "Guardar notas" : "Notas al día"}</button>}
    >
      <div className="-mx-5 overflow-x-auto px-5 md:-mx-6 md:px-6">
        <table className="w-full min-w-[640px] border-separate border-spacing-0 text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-[0.14em] text-muted">
              <th className="sticky left-0 z-10 border-b border-line bg-card py-2 pr-3 font-semibold">Estudiante</th>
              {assessments.map((assessment) => (
                <th key={assessment.id} className="border-b border-line px-2 py-2 text-center font-semibold">
                  <span className="block normal-case tracking-normal text-ink">{assessment.title}</span>
                  {assessment.week ? <span className="font-normal normal-case tracking-normal">Semana {assessment.week}</span> : null}
                </th>
              ))}
              <th className="border-b border-line px-2 py-2 text-center font-semibold">Promedio</th>
            </tr>
          </thead>
          <tbody>
            {students.map((student) => {
              const avg = average(assessments.map((assessment) => parse(values[student.id]?.[assessment.id] ?? "")));
              return (
                <tr key={student.id} className="align-middle">
                  <td className="sticky left-0 z-10 border-b border-line bg-card py-2.5 pr-3">
                    <p className="font-semibold">{student.name}</p>
                    <p className="text-xs text-muted">{student.username}{student.status !== "cursando" ? ` · ${student.status}` : ""}</p>
                  </td>
                  {assessments.map((assessment) => {
                    const raw = values[student.id]?.[assessment.id] ?? "";
                    const score = parse(raw);
                    const invalid = score !== null && (Number.isNaN(score) || score < 0 || score > maxScore);
                    const low = score !== null && !invalid && score < level.pass_score;
                    return (
                      <td key={assessment.id} className="border-b border-line px-2 py-2 text-center">
                        <input
                          value={raw}
                          onChange={(event) => change(student.id, assessment.id, event.target.value)}
                          inputMode="decimal"
                          aria-label={`${assessment.title} de ${student.name}`}
                          className={`w-16 rounded-lg border px-2 py-1.5 text-center font-semibold tabular-nums outline-none transition focus:ring-4 focus:ring-ink/5 ${
                            invalid ? "border-red-400 bg-red-50 text-red-700" : low ? "border-red-200 text-red-700" : "border-line bg-white"
                          }`}
                        />
                      </td>
                    );
                  })}
                  <td className="border-b border-line px-2 py-2 text-center">
                    {avg === null ? <span className="text-muted">—</span> : <Pill tone={avg >= level.pass_score ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}>{avg.toFixed(1)}</Pill>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-4"><Notice result={result} onClose={() => setResult(null)} /></div>
    </Panel>
  );
}
