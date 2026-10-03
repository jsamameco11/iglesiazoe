import AdminLayout from "@/Layouts/AdminLayout";
import { PageHeader, PeriodFilter, Stat, input } from "@/Components/admin/ui";
import { CellCode } from "@/Components/ui/cell-code";
import { can, money, usePanelUser } from "@/lib/access";

type Photo = { id: string; previewUrl: string; downloadUrl: string; fileName: string };
type Row = {
  report: {
    id: string;
    year: number;
    week: number;
    met: boolean;
    meeting_date: string | null;
    modality: string | null;
    theme_title: string | null;
    offering: number | null;
    tithes: number | null;
    network: string | null;
    salvations: number;
    families: number;
    guests: number;
    cell_code: string | null;
    leader: string;
    username: string | null;
    attendance: number;
  };
  photos: Photo[];
};

type Props = {
  rows: Row[];
  showMoney: boolean;
  showTithes: boolean;
  filters: Record<string, string | number>;
  label: string;
  weeks: { week: number; label: string }[];
  networks: string[];
  totals: { reports: number; met: number; attendance: number; salvations: number; offering: number | null };
};

export default function Informes({ rows, showMoney, showTithes, filters, label, weeks, networks, totals }: Props) {
  const user = usePanelUser();
  return (
    <AdminLayout>
      <div className="pb-16">
        <PageHeader kicker="Supervisión pastoral" title="Reportes de servidores" text="Los informes de todas las células. Filtra por semana, mes o año, por red y por estado, y descarga las evidencias." />
        <div className="mt-6">
          <PeriodFilter
            url="/admin/informes"
            filters={filters}
            weeks={weeks}
            modes={[{ key: "semana", label: "Semana" }, { key: "mes", label: "Mes" }, { key: "anio", label: "Año" }]}
            extra={
              <>
                <label className="text-xs font-semibold text-muted">Red
                  <select name="red" defaultValue={filters.red} className={`${input} min-w-24`}>
                    <option value="">Todas</option>
                    {networks.map((code) => <option key={code} value={code}>Red {code}</option>)}
                  </select>
                </label>
                <label className="text-xs font-semibold text-muted">Estado
                  <select name="estado" defaultValue={filters.estado} className={`${input} min-w-32`}>
                    <option value="">Todos</option>
                    <option value="si">Se reunió</option>
                    <option value="no">No se reunió</option>
                  </select>
                </label>
              </>
            }
          />
        </div>
        <p className="mt-6 text-sm font-semibold text-muted">{label}</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="Informes" value={totals.reports} note={`${totals.met} se reunieron`} tone="bg-blush" />
          <Stat label="Asistencia" value={totals.attendance} note="Integrantes presentes" tone="bg-mist" />
          <Stat label="Nuevos creyentes" value={totals.salvations} tone="bg-sky" />
          {totals.offering !== null
            ? <Stat label="Ofrendas" value={money(totals.offering)} note={showTithes ? "Diezmos en Finanzas" : "De la semana elegida"} tone="bg-white" />
            : can(user, "offerings.weekly") && <Stat label="Ofrendas" value="—" note="Elige la vista Semana para verlas" tone="bg-white" />}
        </div>
        <div className="mt-7 grid gap-5">
          {rows.map(({ report, photos }) => (
            <article key={report.id} className="overflow-hidden rounded-[1.75rem] border border-line bg-card shadow-[0_18px_60px_rgba(42,39,36,0.06)]">
              <div className="grid gap-6 p-6 lg:grid-cols-[1fr_auto]">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-paper px-3 py-1 text-xs font-semibold text-ink">Célula <CellCode code={report.cell_code} />{report.network ? ` · Red ${report.network}` : ""}</span>
                    <span className="rounded-full bg-orange/15 px-3 py-1 text-xs font-semibold text-orange-deep">Semana {report.week} · {report.year}</span>
                    <span className="text-xs text-muted">{report.meeting_date || (report.met ? "Fecha no registrada" : "No se reunió")}</span>
                  </div>
                  <h2 className="mt-5 text-2xl font-medium tracking-tight">{report.met ? report.theme_title || "Tema sin título" : "La célula no se reunió"}</h2>
                  <p className="mt-2 text-sm text-muted">
                    Subido por <strong className="font-semibold text-ink">{report.leader}</strong>
                    {report.username ? ` · Usuario ${report.username}` : ""}
                    {report.modality ? ` · ${report.modality === "virtual" ? "Virtual" : "Presencial"}` : ""}
                  </p>
                </div>
                <div className={`grid grid-cols-2 gap-2 lg:min-w-[440px] ${showTithes ? "sm:grid-cols-5" : "sm:grid-cols-4"}`}>
                  {[
                    ["Asistencia", report.attendance],
                    ["Salvos", report.salvations || 0],
                    ["Familias", report.families || 0],
                    [showMoney ? "Ofrenda" : "Reunión", showMoney ? money(report.offering) : report.met ? "Realizada" : "No realizada"],
                    ...(showTithes ? [["Diezmos", money(report.tithes)]] : []),
                  ].map(([label, value]) => (
                    <div key={String(label)} className="rounded-2xl bg-paper px-4 py-3">
                      <p className="text-xs text-muted">{label}</p>
                      <p className="mt-1 text-lg font-semibold">{value}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="border-t border-line bg-white/70 p-6">
                <h3 className="font-semibold">Evidencias fotográficas</h3>
                <p className="mt-1 text-xs text-muted">{photos.length ? `${photos.length} archivo${photos.length === 1 ? "" : "s"}` : "Este informe no tiene imágenes"}</p>
                {photos.length > 0 && (
                  <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    {photos.map((photo, index) => (
                      <div key={photo.id} className="group overflow-hidden rounded-2xl border border-line bg-card">
                        {photo.previewUrl ? (
                          <img src={photo.previewUrl} alt={`Evidencia ${index + 1}`} className="aspect-[4/3] w-full object-cover" />
                        ) : (
                          <div className="flex aspect-[4/3] items-center justify-center bg-paper text-sm text-muted">Vista no disponible</div>
                        )}
                        <div className="flex items-center justify-between gap-3 p-3">
                          <p className="min-w-0 truncate text-xs text-muted">{photo.fileName}</p>
                          {photo.downloadUrl && (
                            <a href={photo.downloadUrl} download={photo.fileName} className="shrink-0 rounded-full bg-ink px-3 py-2 text-xs font-semibold text-white">Descargar</a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </article>
          ))}
          {!rows.length && (
            <div className="rounded-[1.75rem] border border-dashed border-line bg-card px-6 py-16 text-center">
              <p className="text-lg font-medium">Todavía no hay informes.</p>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
