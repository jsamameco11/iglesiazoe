import { useState } from "react";
import { Field, Pill, RecordForm } from "@/Components/admin/record-ui";
import { STUDY_KICKER } from "@/Components/admin/study-ui";
import { PageHeader, button, ghost, input } from "@/Components/admin/ui";
import AdminLayout from "@/Layouts/AdminLayout";
import { classLine, formatStudyDate, plural, scheduleLabel, type StudyLevel } from "@/lib/studies";
import { useSiteUrl } from "@/lib/access";

type Level = StudyLevel & { weeks: number; starts_on: string | null; ends_on: string | null; class_time: string; students: number };

const stateTone: Record<string, string> = {
  running: "bg-emerald-50 text-emerald-800",
  upcoming: "bg-amber text-[#7a5418]",
  finished: "bg-paper text-muted",
  pending: "bg-paper text-muted",
};

export default function Niveles({ levels }: { levels: Level[] }) {
  const [creating, setCreating] = useState(false);
  const site = useSiteUrl();

  return (
    <AdminLayout>
      <PageHeader
        kicker={STUDY_KICKER}
        title="Niveles y horarios"
        text="Cada nivel tiene su fecha de inicio, cuántas semanas dura y la hora de clase. Con eso el aula le muestra a cada estudiante en qué semana va, cuándo termina y cuánto falta para su próxima clase."
        aside={
          <div className="flex flex-wrap gap-2">
            <a href={`${site}/ruta-del-servidor`} target="_blank" rel="noreferrer" className={ghost}>Ver la ruta en la web ↗</a>
            {!creating ? <button type="button" onClick={() => setCreating(true)} className={button}>+ Nuevo nivel</button> : null}
          </div>
        }
      />

      {creating ? (
        <div className="mt-6">
          <LevelForm onDone={() => setCreating(false)} onCancel={() => setCreating(false)} />
        </div>
      ) : null}

      <div className="mt-6 grid gap-5">
        {levels.map((level, index) => (
          <LevelForm key={level.id} level={level} number={index + 1} />
        ))}
      </div>
    </AdminLayout>
  );
}

function LevelForm({ level, number, onDone, onCancel }: { level?: Level; number?: number; onDone?: () => void; onCancel?: () => void }) {
  const schedule = level?.schedule;
  return (
    <RecordForm url="/admin/estudios/niveles" id={level?.id} submitLabel={level ? "Guardar nivel" : "Crear nivel"} onDone={onDone} onCancel={onCancel}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-ink text-sm font-semibold text-white">{number ?? "+"}</span>
          <div>
            <h2 className="text-lg font-semibold tracking-[-0.02em]">{level ? level.name : "Nuevo nivel"}</h2>
            {schedule ? (
              <p className="text-xs text-muted">
                {classLine(schedule)}
                {schedule.ends_on ? ` · termina el ${formatStudyDate(schedule.ends_on, true)}` : ""}
              </p>
            ) : null}
          </div>
        </div>
        {level && schedule ? (
          <div className="flex flex-wrap gap-2">
            <Pill tone={stateTone[schedule.state]}>{scheduleLabel(schedule)}</Pill>
            <Pill>{plural(level.students, "estudiante", "estudiantes")}</Pill>
            {!level.active ? <Pill tone="bg-red-50 text-red-700">Oculto</Pill> : null}
          </div>
        ) : null}
      </div>

      <div className="grid gap-3 md:grid-cols-[1.2fr_2fr]">
        <Field label="Nombre del nivel"><input name="name" required maxLength={80} defaultValue={level?.name} className={input} /></Field>
        <Field label="Descripción breve"><input name="summary" maxLength={400} defaultValue={level?.summary ?? ""} placeholder="Qué se aprende en este nivel" className={input} /></Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Primera clase" hint="El día de la semana de esta fecha es el día de clase.">
          <input name="starts_on" type="date" defaultValue={level?.starts_on ?? ""} className={input} />
        </Field>
        <Field label="Semanas que dura"><input name="weeks" type="number" min={1} max={52} required defaultValue={level?.weeks ?? 8} className={input} /></Field>
        <Field label="Hora de inicio"><input name="class_time" type="time" required defaultValue={level?.class_time ?? "09:00"} className={input} /></Field>
        <Field label="Clausura (opcional)" hint="Si la dejas vacía, se calcula con las semanas.">
          <input name="ends_on" type="date" defaultValue={level?.ends_on ?? ""} className={input} />
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Lugar"><input name="place" maxLength={120} defaultValue={level?.place ?? ""} placeholder="Ej. Salón 2, Simón Bolívar 750" className={input} /></Field>
        <Field label="Maestro(a)"><input name="teacher" maxLength={120} defaultValue={level?.teacher ?? ""} className={input} /></Field>
        <Field label="Nota aprobatoria (0 a 20)"><input name="pass_score" type="number" min={0} max={20} step={0.5} required defaultValue={level?.pass_score ?? 11} className={input} /></Field>
        <Field label="Orden en la ruta"><input name="sort_order" type="number" min={0} max={999} defaultValue={level?.sort_order ?? ""} className={input} /></Field>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="active" defaultChecked={level ? level.active : true} className="h-4 w-4 accent-ink" /> Visible en la web y en el aula
      </label>
    </RecordForm>
  );
}
