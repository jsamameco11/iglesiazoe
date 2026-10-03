import { useState } from "react";
import { EmptyState, Field, Pill, RecordForm } from "@/Components/admin/record-ui";
import { LevelSelect, STUDY_KICKER } from "@/Components/admin/study-ui";
import { PageHeader, button, input } from "@/Components/admin/ui";
import AdminLayout from "@/Layouts/AdminLayout";
import type { LevelOption, StudyVerse } from "@/lib/studies";

export default function Animo({ levels, verses }: { levels: LevelOption[]; verses: StudyVerse[] }) {
  const [creating, setCreating] = useState(false);
  const levelName = (id: string | null) => levels.find((level) => level.id === id)?.name ?? "Todos los niveles";

  return (
    <AdminLayout>
      <PageHeader
        kicker={STUDY_KICKER}
        title="Versículos y ánimo"
        text="Cada día el aula muestra uno de estos versículos o palabras de ánimo, y el estudiante puede pasar al siguiente, marcarlo con «Amén» y compartirlo. Con cita bíblica se muestra como versículo; sin cita, como palabra de ánimo."
        aside={!creating ? <button type="button" onClick={() => setCreating(true)} className={button}>+ Agregar</button> : null}
      />

      {creating ? (
        <div className="mt-6">
          <VerseForm levels={levels} onCancel={() => setCreating(false)} />
        </div>
      ) : null}

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {verses.length ? (
          verses.map((verse) => (
            <div key={verse.id} className="grid gap-3">
              <figure className="m-0 rounded-[1.4rem] bg-ink px-5 py-5 text-white">
                <blockquote className="text-[15px] leading-6">“{verse.text}”</blockquote>
                <figcaption className="mt-3 flex flex-wrap items-center gap-2 text-xs text-white/70">
                  <span className="font-semibold text-white">{verse.reference || "Palabra de ánimo"}</span>
                  <span>· {levelName(verse.level_id)}</span>
                  {!verse.active ? <Pill tone="bg-white/15 text-white">Oculto</Pill> : null}
                </figcaption>
              </figure>
              <VerseForm verse={verse} levels={levels} />
            </div>
          ))
        ) : (
          <EmptyState>Aún no hay versículos. Agrega el primero.</EmptyState>
        )}
      </div>
    </AdminLayout>
  );
}

function VerseForm({ verse, levels, onCancel }: { verse?: StudyVerse; levels: LevelOption[]; onCancel?: () => void }) {
  return (
    <RecordForm
      url="/admin/estudios/animo"
      id={verse?.id}
      deleteUrl="/admin/estudios/animo/eliminar"
      confirmText="¿Eliminar este versículo?"
      submitLabel={verse ? "Guardar" : "Agregar al aula"}
      onCancel={onCancel}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Cita bíblica (opcional)"><input name="reference" maxLength={80} defaultValue={verse?.reference ?? ""} placeholder="Ej. Filipenses 4:13" className={input} /></Field>
        <LevelSelect levels={levels} value={verse?.level_id} label="Para" />
      </div>
      <Field label="Texto">
        <textarea name="text" required maxLength={600} rows={3} defaultValue={verse?.text} placeholder="Todo lo puedo en Cristo que me fortalece." className={input} />
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="active" defaultChecked={verse ? verse.active : true} className="h-4 w-4 accent-ink" /> Visible en el aula
      </label>
    </RecordForm>
  );
}
