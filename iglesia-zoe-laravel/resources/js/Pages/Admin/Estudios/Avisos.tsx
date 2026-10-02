import { useState } from "react";
import { EmptyState, Field, LevelSelect, Pill, RecordForm, STUDY_KICKER } from "@/Components/admin/study-ui";
import { PageHeader, button, input } from "@/Components/admin/ui";
import AdminLayout from "@/Layouts/AdminLayout";
import { formatStudyDate, type LevelOption, type StudyNotice } from "@/lib/studies";

type Props = { levels: LevelOption[]; tones: Record<string, string>; notices: StudyNotice[]; today: string };

const toneStyle: Record<string, string> = {
  aviso: "bg-sky text-[#28516b]",
  importante: "bg-orange/15 text-orange-deep",
  celebracion: "bg-mist text-[#3d6248]",
};

function status(notice: StudyNotice, today: string) {
  if (!notice.active) return { label: "Oculto", tone: "bg-paper text-muted" };
  if (notice.starts_on && notice.starts_on > today) return { label: `Desde el ${formatStudyDate(notice.starts_on)}`, tone: "bg-amber text-[#7a5418]" };
  if (notice.ends_on && notice.ends_on < today) return { label: "Vencido", tone: "bg-paper text-muted" };
  return { label: "Visible en el aula", tone: "bg-emerald-50 text-emerald-800" };
}

export default function Avisos({ levels, tones, notices, today }: Props) {
  const [creating, setCreating] = useState(notices.length === 0);
  const levelName = (id: string | null) => levels.find((level) => level.id === id)?.name ?? "Todos los niveles";

  return (
    <AdminLayout>
      <PageHeader
        kicker={STUDY_KICKER}
        title="Avisos del aula"
        text="Los avisos aparecen como notificación apenas el estudiante entra a su aula y quedan en su bandeja de avisos. Puedes dirigirlos a un nivel o a todos, y programar desde y hasta cuándo se ven."
        aside={!creating ? <button type="button" onClick={() => setCreating(true)} className={button}>+ Nuevo aviso</button> : null}
      />

      {creating ? (
        <div className="mt-6">
          <NoticeForm levels={levels} tones={tones} today={today} onCancel={notices.length ? () => setCreating(false) : undefined} />
        </div>
      ) : null}

      <div className="mt-6 grid gap-4">
        {notices.length ? (
          notices.map((notice) => {
            const state = status(notice, today);
            return (
              <details key={notice.id} className="group rounded-[1.4rem] border border-line bg-card">
                <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3 px-4 py-3.5 md:px-5">
                  <Pill tone={toneStyle[notice.tone]}>{tones[notice.tone]}</Pill>
                  <span className="min-w-0 flex-1 truncate font-semibold">{notice.title}</span>
                  <span className="text-xs text-muted">{levelName(notice.level_id)}</span>
                  <Pill tone={state.tone}>{state.label}</Pill>
                  <span className="text-xs text-muted transition group-open:rotate-180">▼</span>
                </summary>
                <div className="px-2 pb-2">
                  <NoticeForm notice={notice} levels={levels} tones={tones} today={today} />
                </div>
              </details>
            );
          })
        ) : (
          <EmptyState>Aún no hay avisos publicados.</EmptyState>
        )}
      </div>
    </AdminLayout>
  );
}

function NoticeForm({ notice, levels, tones, today, onCancel }: { notice?: StudyNotice; levels: LevelOption[]; tones: Record<string, string>; today: string; onCancel?: () => void }) {
  return (
    <RecordForm
      url="/admin/estudios/avisos"
      id={notice?.id}
      deleteUrl="/admin/estudios/avisos/eliminar"
      confirmText={`¿Eliminar el aviso «${notice?.title}»?`}
      submitLabel={notice ? "Guardar aviso" : "Publicar aviso"}
      onCancel={onCancel}
      className={notice ? "border-0 bg-transparent p-3 md:p-3" : ""}
    >
      {!notice ? <h2 className="text-lg font-semibold tracking-[-0.02em]">Nuevo aviso</h2> : null}
      <div className="grid gap-3 md:grid-cols-[2fr_1fr_1fr]">
        <Field label="Título"><input name="title" required maxLength={120} defaultValue={notice?.title} placeholder="Ej. Este sábado no hay clase" className={input} /></Field>
        <Field label="Tipo">
          <select name="tone" defaultValue={notice?.tone ?? "aviso"} className={input}>
            {Object.entries(tones).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </Field>
        <LevelSelect levels={levels} value={notice?.level_id} label="Para" />
      </div>
      <Field label="Mensaje">
        <textarea name="body" required maxLength={2000} rows={4} defaultValue={notice?.body} placeholder="Escribe el aviso tal como quieres que lo lean." className={input} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2 md:max-w-lg">
        <Field label="Visible desde" hint="Vacío = desde hoy."><input name="starts_on" type="date" defaultValue={notice?.starts_on ?? ""} min={notice ? undefined : today} className={input} /></Field>
        <Field label="Visible hasta" hint="Vacío = sin fecha de fin."><input name="ends_on" type="date" defaultValue={notice?.ends_on ?? ""} className={input} /></Field>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="active" defaultChecked={notice ? notice.active : true} className="h-4 w-4 accent-ink" /> Publicado
      </label>
    </RecordForm>
  );
}
