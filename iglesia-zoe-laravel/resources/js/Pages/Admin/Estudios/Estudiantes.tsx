import { useMemo, useState } from "react";
import { Field, LevelSelect, Pill, RecordForm, STUDY_KICKER, EmptyState, useSiteUrl } from "@/Components/admin/study-ui";
import { PageHeader, Stat, button, ghost, input } from "@/Components/admin/ui";
import AdminLayout from "@/Layouts/AdminLayout";
import type { LevelOption } from "@/lib/studies";

type Student = {
  id: string;
  name: string;
  username: string;
  phone: string | null;
  network: string | null;
  level_id: string | null;
  level: string | null;
  status: string;
  active: boolean;
  average: number | null;
};

type Props = { levels: (LevelOption & { active: boolean })[]; statuses: Record<string, string>; students: Student[] };

const statusTone: Record<string, string> = {
  cursando: "bg-emerald-50 text-emerald-800",
  pausado: "bg-amber text-[#7a5418]",
  egresado: "bg-sky text-[#28516b]",
};

export default function Estudiantes({ levels, statuses, students }: Props) {
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState("all");
  const site = useSiteUrl();

  const shown = useMemo(() => {
    const text = query.trim().toLowerCase();
    return students.filter(
      (student) =>
        (level === "all" || student.level_id === level || (level === "none" && !student.level_id)) &&
        (!text || `${student.name} ${student.username} ${student.network ?? ""}`.toLowerCase().includes(text)),
    );
  }, [students, query, level]);

  const studying = students.filter((student) => student.status === "cursando").length;

  return (
    <AdminLayout>
      <PageHeader
        kicker={STUDY_KICKER}
        title="Estudiantes"
        text="Crea la cuenta de cada estudiante y ubícalo en su nivel. Ingresan desde la web, en Estudios → Acceso de estudiantes, con su DNI y su clave. Si no escribes una clave, su clave inicial es su mismo DNI; luego la pueden cambiar desde su aula."
        aside={
          <div className="flex flex-wrap gap-2">
            <a href={`${site}/estudios/acceso`} target="_blank" rel="noreferrer" className={ghost}>Acceso de estudiantes ↗</a>
            {!creating ? <button type="button" onClick={() => setCreating(true)} className={button}>+ Nuevo estudiante</button> : null}
          </div>
        }
      />

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <Stat label="Estudiantes" value={students.length} note="Cuentas creadas" />
        <Stat label="Cursando ahora" value={studying} tone="bg-mist" />
        <Stat label="Egresados de la ruta" value={students.filter((student) => student.status === "egresado").length} tone="bg-sky" />
      </div>

      {creating ? (
        <div className="mt-6">
          <StudentForm levels={levels} statuses={statuses} onCancel={() => setCreating(false)} />
        </div>
      ) : null}

      <div className="mt-8 flex flex-wrap items-center gap-2">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por nombre, DNI o red" className={`${input} mt-0 max-w-xs`} />
        {[{ id: "all", name: "Todos" }, ...levels, { id: "none", name: "Sin nivel" }].map((item) => {
          const count = item.id === "all" ? students.length : students.filter((student) => (item.id === "none" ? !student.level_id : student.level_id === item.id)).length;
          if (item.id === "none" && !count) return null;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setLevel(item.id)}
              className={`rounded-full px-3.5 py-2 text-xs font-semibold transition ${level === item.id ? "bg-ink text-white" : "border border-line bg-white text-muted hover:text-ink"}`}
            >
              {item.name} · {count}
            </button>
          );
        })}
      </div>

      <div className="mt-4 grid gap-3">
        {shown.length ? (
          shown.map((student) =>
            editing === student.id ? (
              <StudentForm key={student.id} student={student} levels={levels} statuses={statuses} onCancel={() => setEditing(null)} />
            ) : (
              <article key={student.id} className="flex flex-wrap items-center gap-4 rounded-[1.25rem] border border-line bg-card px-4 py-3.5">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-sage text-sm font-semibold">{initials(student.name)}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold tracking-[-0.01em]">{student.name}</p>
                  <p className="truncate text-xs text-muted">
                    {student.username}
                    {student.network ? ` · ${student.network}` : ""}
                    {student.phone ? ` · ${student.phone}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Pill tone="bg-white border border-line text-ink">{student.level ?? "Sin nivel"}</Pill>
                  <Pill tone={statusTone[student.status]}>{statuses[student.status]}</Pill>
                  {student.average !== null ? <Pill tone="bg-paper text-ink">Promedio {student.average.toFixed(1)}</Pill> : null}
                  {!student.active ? <Pill tone="bg-red-50 text-red-700">Sin acceso</Pill> : null}
                </div>
                <button type="button" onClick={() => setEditing(student.id)} className={ghost}>Editar</button>
              </article>
            ),
          )
        ) : (
          <EmptyState>{students.length ? "Nadie coincide con la búsqueda." : "Aún no hay estudiantes. Crea el primero con «+ Nuevo estudiante»."}</EmptyState>
        )}
      </div>
    </AdminLayout>
  );
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
}

function StudentForm({ student, levels, statuses, onDone, onCancel }: { student?: Student; levels: LevelOption[]; statuses: Record<string, string>; onDone?: () => void; onCancel?: () => void }) {
  return (
    <RecordForm
      url="/admin/estudios/estudiantes"
      id={student?.id}
      deleteUrl="/admin/estudios/estudiantes/eliminar"
      confirmText={`¿Eliminar a ${student?.name}? Se borran su cuenta y todas sus notas.`}
      submitLabel={student ? "Guardar" : "Crear estudiante"}
      onDone={onDone}
      onCancel={onCancel}
    >
      <h2 className="text-lg font-semibold tracking-[-0.02em]">{student ? student.name : "Nuevo estudiante"}</h2>
      <div className="grid gap-3 md:grid-cols-3">
        <Field label="Nombres y apellidos"><input name="name" required maxLength={120} defaultValue={student?.name} className={input} /></Field>
        <Field label="DNI o usuario" hint="Con esto ingresa al aula."><input name="username" required maxLength={40} defaultValue={student?.username} inputMode="text" autoComplete="off" className={input} /></Field>
        <Field label={student ? "Nueva clave (opcional)" : "Clave (opcional)"} hint={student ? "Déjala vacía para no cambiarla." : "Vacía = su clave será su DNI o usuario."}>
          <input name="password" type="text" minLength={6} maxLength={120} autoComplete="new-password" className={input} />
        </Field>
      </div>
      <div className="grid gap-3 md:grid-cols-4">
        <LevelSelect levels={levels} value={student?.level_id} allLabel="Sin nivel por ahora" />
        <Field label="Estado">
          <select name="status" defaultValue={student?.status ?? "cursando"} className={input}>
            {Object.entries(statuses).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </Field>
        <Field label="Celular"><input name="phone" maxLength={30} defaultValue={student?.phone ?? ""} inputMode="tel" className={input} /></Field>
        <Field label="Red o célula"><input name="network" maxLength={60} defaultValue={student?.network ?? ""} placeholder="Ej. Red K" className={input} /></Field>
      </div>
      {student ? (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="active" defaultChecked={student.active} className="h-4 w-4 accent-ink" /> Puede ingresar a su aula
        </label>
      ) : null}
    </RecordForm>
  );
}
