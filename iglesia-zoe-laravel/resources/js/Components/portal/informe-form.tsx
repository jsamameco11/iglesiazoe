
import { useMemo, useState, useTransition } from "react";
import { addParticipant, loadInforme, saveReport } from "@/lib/actions";
import { meetingDateInWeek, weeksOfYear } from "@/lib/weeks";
import type { Cell, Member, Theme } from "@/lib/types";

type Attendance = { member_id: string; member_name: string; attended: boolean; tithe: number };
type Loaded = Awaited<ReturnType<typeof loadInforme>>;

const input = "mt-1 w-full rounded-xl border border-line bg-white px-3 py-2.5 outline-none focus:border-orange";

export function InformeForm({
  cells,
  year,
  week,
}: {
  cells: Cell[];
  year: number;
  week: number;
}) {
  const [cellId, setCellId] = useState(cells[0]?.id || "");
  const [selectedYear, setYear] = useState(year);
  const [selectedWeek, setWeek] = useState(week);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [message, setMessage] = useState("");
  const [pending, start] = useTransition();
  const weeks = useMemo(() => weeksOfYear(selectedYear), [selectedYear]);
  const years = [year - 1, year, year + 1];

  function search() {
    setMessage("");
    start(async () => {
      const result = await loadInforme(cellId, selectedYear, selectedWeek);
      setLoaded(result);
    });
  }

  const cell = loaded?.cell as Cell | null;
  const members = (loaded?.members || []) as Member[];
  const report = loaded?.report as Record<string, unknown> | null;
  const themes = (loaded?.themes || []) as Theme[];
  const weekMeta = weeks.find((item) => item.week === selectedWeek);

  return (
    <div>
      <div className="grid gap-4 rounded-[1.5rem] border border-line bg-card p-5 md:grid-cols-4">
        <label className="text-sm">Año
          <select className={input} value={selectedYear} onChange={(event) => setYear(Number(event.target.value))}>
            {years.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <label className="text-sm md:col-span-2">Semana
          <select className={input} value={selectedWeek} onChange={(event) => setWeek(Number(event.target.value))}>
            {weeks.map((item) => <option key={item.week} value={item.week}>{item.label}</option>)}
          </select>
        </label>
        <label className="text-sm">Célula
          <select className={input} value={cellId} onChange={(event) => setCellId(event.target.value)}>
            {cells.map((item) => <option key={item.id} value={item.id}>{item.code}</option>)}
          </select>
        </label>
        <button onClick={search} className="rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-white md:col-span-4 md:w-fit">
          {pending ? "Buscando…" : "Buscar"}
        </button>
      </div>

      {message && <p className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</p>}

      {cell && (
        <ReportCard
          key={`${cell.id}-${selectedYear}-${selectedWeek}-${report ? "saved" : "new"}`}
          cell={cell}
          members={members}
          themes={themes}
          report={report}
          photos={(loaded?.photos || []) as { id: string; url: string }[]}
          year={selectedYear}
          week={selectedWeek}
          suggestedDate={meetingDateInWeek(selectedYear, selectedWeek, cell.meeting_day)}
          weekLabel={weekMeta?.label || ""}
          onSaved={(text) => {
            setMessage(text);
            search();
          }}
        />
      )}
    </div>
  );
}

function ReportCard({
  cell, members, themes, report, photos, year, week, suggestedDate, weekLabel, onSaved,
}: {
  cell: Cell;
  members: Member[];
  themes: Theme[];
  report: Record<string, unknown> | null;
  photos: { id: string; url: string }[];
  year: number;
  week: number;
  suggestedDate: string;
  weekLabel: string;
  onSaved: (text: string) => void;
}) {
  const matched = themes.find((theme) => {
    const date = new Date(theme.theme_date + "T12:00:00");
    const start = new Date(suggestedDate + "T12:00:00");
    start.setDate(start.getDate() - start.getDay());
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return date >= start && date <= end;
  });

  const [met, setMet] = useState(report ? (report.met ? "si" : "no") : "");
  const [themeId, setThemeId] = useState(String(report?.theme_id || matched?.id || ""));
  const [themeTitle, setThemeTitle] = useState(String(report?.theme_title || matched?.title || ""));
  const [rows, setRows] = useState<Attendance[]>(() => {
    const saved = (report?.report_attendance as Attendance[]) || [];
    if (saved.length) return saved;
    return members.map((member) => ({ member_id: member.id, member_name: member.full_name, attended: false, tithe: 0 }));
  });
  const [person, setPerson] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  function submit(formData: FormData) {
    formData.set("attendance", JSON.stringify(rows));
    formData.set("theme_title", themeTitle);
    formData.set("met", met);
    start(async () => {
      const result = await saveReport(formData);
      if (result.error) setError(result.error);
      else onSaved("Informe guardado.");
    });
  }

  return (
    <form action={submit} className="mt-6 overflow-hidden rounded-[1.5rem] border border-orange/40 bg-card">
      <div className="bg-orange px-6 py-4 text-white">
        <p className="text-2xl font-light">Cód. Celular: {cell.code}</p>
        <p className="text-sm text-white/80">{weekLabel}</p>
      </div>
      <div className="space-y-6 p-6">
        <input type="hidden" name="cell_id" value={cell.id} />
        <input type="hidden" name="year" value={year} />
        <input type="hidden" name="week" value={week} />
        {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <label className="block text-sm font-medium">¿Has tenido reunión de célula en la semana que estás seleccionando?
          <select className={input} value={met} onChange={(event) => setMet(event.target.value)} required>
            <option value="">Seleccione respuesta</option>
            <option value="si">SI</option>
            <option value="no">NO</option>
          </select>
        </label>

        {met === "no" && (
          <label className="block text-sm">Ingrese el motivo
            <textarea name="reason" required defaultValue={String(report?.reason || "")} placeholder="Ingrese el motivo porque no se reunieron" className={input} rows={3} />
          </label>
        )}

        {met === "si" && (
          <>
            <div className="grid gap-4 rounded-2xl border border-line p-4 sm:grid-cols-2">
              <p><span className="font-medium">Líder:</span> {cell.leader_name || "Por asignar"}</p>
              <p><span className="font-medium">Líder ayudante:</span> {cell.assistant_name || "—"}</p>
              <p><span className="font-medium">Anfitrión:</span> {cell.host_name || "—"}</p>
              <p><span className="font-medium">Dirección:</span> {cell.address || "—"}</p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <label className="text-sm">Día de la reunión<input type="date" name="meeting_date" defaultValue={String(report?.meeting_date || suggestedDate)} className={input} /></label>
              <label className="text-sm">Hora de inicio<input type="time" name="start_time" defaultValue={String(report?.start_time || cell.meeting_time || "19:00").slice(0, 5)} className={input} /></label>
              <label className="text-sm">Hora de fin<input type="time" name="end_time" defaultValue={String(report?.end_time || "20:30").slice(0, 5)} className={input} /></label>
              <label className="text-sm">Modalidad
                <select name="modality" defaultValue={String(report?.modality || "presencial")} className={`${input} text-red-700`}>
                  <option value="presencial">Presencial</option>
                  <option value="virtual">Virtual</option>
                </select>
              </label>
              <label className="text-sm md:col-span-2">Tema
                <select
                  name="theme_id"
                  className={input}
                  value={themeId}
                  onChange={(event) => {
                    setThemeId(event.target.value);
                    const theme = themes.find((item) => item.id === event.target.value);
                    if (theme) setThemeTitle(theme.title);
                  }}
                >
                  <option value="">Escribir otro tema</option>
                  {themes.map((theme) => <option key={theme.id} value={theme.id}>{theme.theme_date} · {theme.title}</option>)}
                </select>
              </label>
              <label className="text-sm md:col-span-3">Título del tema
                <input name="theme_title_visible" value={themeTitle} onChange={(event) => setThemeTitle(event.target.value)} className={input} />
              </label>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <NumberField label="Tiempo de alabanza (min)" name="praise_minutes" defaultValue={report?.praise_minutes} />
              <NumberField label="Tiempo de enseñanza (min)" name="teaching_minutes" defaultValue={report?.teaching_minutes} />
              <NumberField label="Tiempo de ofrenda (min)" name="offering_minutes" defaultValue={report?.offering_minutes} />
              <label className="text-sm">¿Hubo oración?
                <select name="had_prayer" defaultValue={report?.had_prayer == null ? "si" : report.had_prayer ? "si" : "no"} className={input}>
                  <option value="si">SI</option>
                  <option value="no">NO</option>
                </select>
              </label>
              <label className="text-sm md:col-span-2">¿Por qué oraron?
                <input name="prayer_notes" defaultValue={String(report?.prayer_notes || "")} className={input} />
              </label>
              <NumberField label="N° de personas salvas" name="salvations" defaultValue={report?.salvations} />
              <NumberField label="Bautizados en espíritu" name="spirit_baptisms" defaultValue={report?.spirit_baptisms} />
              <NumberField label="Reconciliados" name="reconciled" defaultValue={report?.reconciled} />
              <label className="text-sm">Ofrenda
                <input name="offering" type="number" min={0} step="0.01" defaultValue={Number(report?.offering || 0)} className={input} />
              </label>
              <NumberField label="Cant. de familias" name="families" defaultValue={report?.families} />
              <NumberField label="Invitados" name="guests" defaultValue={report?.guests} />
            </div>
            <label className="block text-sm">Resumir testimonios y sanidades
              <textarea name="testimonies" rows={4} defaultValue={String(report?.testimonies || "")} className={input} />
            </label>
            <div>
              <p className="text-sm font-medium">Subir archivos</p>
              <p className="text-xs text-muted">Fotos de la reunión. Puedes elegir varias.</p>
              <input name="photos" type="file" accept="image/*" multiple className="mt-2 block w-full text-sm" />
              {photos.length > 0 && (
                <div className="mt-3 flex gap-2 overflow-x-auto">
                  {photos.map((photo) => photo.url && <img key={photo.id} src={photo.url} alt="" className="h-24 w-24 rounded-xl object-cover" />)}
                </div>
              )}
            </div>
            <div>
              <div className="mb-3 flex items-end justify-between gap-3">
                <h3 className="font-medium">Integrantes</h3>
                <div className="flex gap-2">
                  <input value={person} onChange={(event) => setPerson(event.target.value)} placeholder="Nuevo integrante" className="rounded-xl border border-line px-3 py-2 text-sm" />
                  <button
                    type="button"
                    className="rounded-full border border-line px-3 py-2 text-sm"
                    onClick={() => start(async () => {
                      const result = await addParticipant(cell.id, person);
                      if (result.error) setError(result.error);
                      else {
                        setRows((current) => [...current, { member_id: "", member_name: person.trim(), attended: true, tithe: 0 }]);
                        setPerson("");
                      }
                    })}
                  >Agregar</button>
                </div>
              </div>
              <div className="overflow-x-auto rounded-2xl border border-line">
                <table className="w-full text-sm">
                  <thead className="bg-paper text-left">
                    <tr>
                      <th className="px-3 py-2">#</th>
                      <th className="px-3 py-2">Participó</th>
                      <th className="px-3 py-2">Integrante</th>
                      <th className="px-3 py-2">Diezmo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, index) => (
                      <tr key={`${row.member_id}-${index}`} className="border-t border-line">
                        <td className="px-3 py-2">{index + 1}</td>
                        <td className="px-3 py-2">
                          <input type="checkbox" checked={row.attended} onChange={(event) => setRows((current) => current.map((item, i) => i === index ? { ...item, attended: event.target.checked } : item))} />
                        </td>
                        <td className="px-3 py-2">{row.member_name}</td>
                        <td className="px-3 py-2">
                          <input type="number" min={0} step="0.01" value={row.tithe} onChange={(event) => setRows((current) => current.map((item, i) => i === index ? { ...item, tithe: Number(event.target.value) } : item))} className="w-28 rounded-lg border border-line px-2 py-1" />
                        </td>
                      </tr>
                    ))}
                    {rows.length === 0 && <tr><td colSpan={4} className="px-3 py-6 text-muted">Aún no hay integrantes. Agrégalos para marcar asistencia y diezmo.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {met && (
          <button disabled={pending} className="rounded-full bg-orange px-6 py-3 text-sm font-medium text-white">
            {pending ? "Guardando…" : met === "si" ? "Enviar informe" : "Guardar"}
          </button>
        )}
      </div>
    </form>
  );
}

function NumberField({ label, name, defaultValue }: { label: string; name: string; defaultValue: unknown }) {
  return (
    <label className="text-sm">{label}
      <input name={name} type="number" min={0} defaultValue={Number(defaultValue || 0)} className={input} />
    </label>
  );
}
