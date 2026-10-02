import { useState } from "react";
import { EmptyState, Field, LevelSelect, Pill, RecordForm, STUDY_KICKER } from "@/Components/admin/study-ui";
import { PageHeader, button, input } from "@/Components/admin/ui";
import AdminLayout from "@/Layouts/AdminLayout";
import type { LevelOption, StudyReading } from "@/lib/studies";

export default function Lecturas({ levels, readings }: { levels: LevelOption[]; readings: StudyReading[] }) {
  const [creating, setCreating] = useState(false);
  const levelName = (id: string | null) => levels.find((level) => level.id === id)?.name ?? "Todos los niveles";

  return (
    <AdminLayout>
      <PageHeader
        kicker={STUDY_KICKER}
        title="Lecturas en PDF"
        text="Sube el material de cada nivel. Los estudiantes lo leen desde su aula, ordenado por semana, y lo pueden descargar."
        aside={!creating ? <button type="button" onClick={() => setCreating(true)} className={button}>+ Subir lectura</button> : null}
      />

      {creating ? (
        <div className="mt-6">
          <ReadingForm levels={levels} onCancel={() => setCreating(false)} />
        </div>
      ) : null}

      <div className="mt-6 grid gap-4">
        {readings.length ? (
          readings.map((reading) => (
            <details key={reading.id} className="group rounded-[1.4rem] border border-line bg-card">
              <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3 px-4 py-3.5 md:px-5">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-orange/15 text-[11px] font-bold text-orange-deep">PDF</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{reading.title}</span>
                  <span className="block truncate text-xs text-muted">{levelName(reading.level_id)}{reading.week ? ` · Semana ${reading.week}` : ""}</span>
                </span>
                {!reading.active ? <Pill tone="bg-paper text-muted">Oculta</Pill> : null}
                <a href={reading.file_url} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()} className="text-sm font-semibold underline-offset-4 hover:underline">Abrir ↗</a>
                <span className="text-xs text-muted transition group-open:rotate-180">▼</span>
              </summary>
              <div className="px-2 pb-2">
                <ReadingForm reading={reading} levels={levels} />
              </div>
            </details>
          ))
        ) : (
          <EmptyState>Aún no hay lecturas. Sube la primera.</EmptyState>
        )}
      </div>
    </AdminLayout>
  );
}

function ReadingForm({ reading, levels, onCancel }: { reading?: StudyReading; levels: LevelOption[]; onCancel?: () => void }) {
  return (
    <RecordForm
      url="/admin/estudios/lecturas"
      id={reading?.id}
      deleteUrl="/admin/estudios/lecturas/eliminar"
      confirmText={`¿Eliminar la lectura «${reading?.title}»?`}
      submitLabel={reading ? "Guardar" : "Publicar lectura"}
      onCancel={onCancel}
      multipart
      className={reading ? "border-0 bg-transparent p-3 md:p-3" : ""}
    >
      {!reading ? <h2 className="text-lg font-semibold tracking-[-0.02em]">Nueva lectura</h2> : null}
      <div className="grid gap-3 md:grid-cols-[2fr_1fr_120px]">
        <Field label="Título"><input name="title" required maxLength={140} defaultValue={reading?.title} placeholder="Ej. Lección 3 · La oración" className={input} /></Field>
        <LevelSelect levels={levels} value={reading?.level_id} label="Nivel" />
        <Field label="Semana"><input name="week" type="number" min={1} max={52} defaultValue={reading?.week ?? ""} className={input} /></Field>
      </div>
      <Field label="Descripción (opcional)"><input name="summary" maxLength={300} defaultValue={reading?.summary ?? ""} className={input} /></Field>
      <Field label={reading ? "Reemplazar PDF (opcional)" : "Archivo PDF"} hint="Hasta 25 MB.">
        <input name="file" type="file" accept="application/pdf,.pdf" required={!reading} className="mt-1.5 block w-full text-sm" />
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="active" defaultChecked={reading ? reading.active : true} className="h-4 w-4 accent-ink" /> Visible en el aula
      </label>
    </RecordForm>
  );
}
