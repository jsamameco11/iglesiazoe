import { getCapabilities, isSuperadmin } from "@/lib/access";
import { getSession } from "@/lib/session";

type ReportPhoto = {
  id: string;
  file_path: string;
  created_at: string;
};

type ReportRow = {
  id: string;
  user_id: string | null;
  year: number;
  week: number;
  met: boolean;
  meeting_date: string | null;
  modality: string | null;
  theme_title: string | null;
  offering: number;
  salvations: number;
  families: number;
  guests: number;
  cells: { code?: string; leader_name?: string | null } | null;
  report_attendance: { attended: boolean }[];
  report_photos: ReportPhoto[];
};

type PhotoLink = ReportPhoto & {
  previewUrl: string;
  downloadUrl: string;
  fileName: string;
};

export default async function ReportsAdmin() {
  const { supabase, profile } = await getSession();
  const capabilities = await getCapabilities(supabase, profile?.role);
  const showMoney = isSuperadmin(profile?.role) || capabilities.viewOfferings;
  if (!isSuperadmin(profile?.role) && !capabilities.viewCellActivity) {
    return (
      <div className="rounded-[1.6rem] border border-line bg-card px-6 py-16">
        <h1 className="text-3xl font-medium tracking-[-0.04em]">Informes no disponibles</h1>
        <p className="mt-3 text-sm text-muted">El superadministrador no habilitó la revisión de actividad celular.</p>
      </div>
    );
  }
  const columns = showMoney
    ? "id, user_id, year, week, met, meeting_date, modality, theme_title, offering, salvations, families, guests, cells(code, leader_name), report_attendance(attended), report_photos(id, file_path, created_at)"
    : "id, user_id, year, week, met, meeting_date, modality, theme_title, salvations, families, guests, cells(code, leader_name), report_attendance(attended), report_photos(id, file_path, created_at)";
  const { data } = await supabase
    .from("reports")
    .select(columns)
    .order("year", { ascending: false })
    .order("week", { ascending: false })
    .limit(150);
  const reports = (data || []) as unknown as ReportRow[];
  const userIds = [...new Set(reports.map((row) => row.user_id).filter((id): id is string => Boolean(id)))];
  const { data: profiles } = userIds.length
    ? await supabase.from("profiles").select("id, full_name, username").in("id", userIds)
    : { data: [] };
  const profileById = new Map(
    (profiles || []).map((profile) => [profile.id, profile]),
  );

  const rows = await Promise.all(
    reports.map(async (report) => {
      const photos = await Promise.all(
        (report.report_photos || []).map(async (photo): Promise<PhotoLink> => {
          const originalName = photo.file_path.split("/").pop() || `imagen-${photo.id}.jpg`;
          const fileName = originalName.replace(/^\d+-/, "");
          const [{ data: preview }, { data: download }] = await Promise.all([
            supabase.storage.from("informes").createSignedUrl(photo.file_path, 60 * 60),
            supabase.storage.from("informes").createSignedUrl(photo.file_path, 60 * 60, {
              download: fileName,
            }),
          ]);
          return {
            ...photo,
            previewUrl: preview?.signedUrl || "",
            downloadUrl: download?.signedUrl || "",
            fileName,
          };
        }),
      );
      return { report, photos, profile: report.user_id ? profileById.get(report.user_id) : null };
    }),
  );

  return (
    <div className="pb-16">
      <div className="flex flex-col gap-3 border-b border-line pb-7 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-orange-deep">Supervisión pastoral</p>
          <h1 className="display mt-3 text-5xl">Informes semanales</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
            Revisa los resultados de cada célula y descarga las evidencias que subió cada usuario.
          </p>
        </div>
        <div className="rounded-2xl border border-line bg-white px-5 py-3 text-right shadow-sm">
          <p className="text-2xl font-semibold">{rows.length}</p>
          <p className="text-xs uppercase tracking-wider text-muted">informes visibles</p>
        </div>
      </div>

      <div className="mt-7 grid gap-5">
        {rows.map(({ report, photos, profile }) => {
          const attendance = (report.report_attendance || []).filter((item) => item.attended).length;
          const leader = profile?.full_name || report.cells?.leader_name || "Usuario sin nombre";
          return (
            <article key={report.id} className="overflow-hidden rounded-[1.75rem] border border-line bg-card shadow-[0_18px_60px_rgba(42,39,36,0.06)]">
              <div className="grid gap-6 p-6 lg:grid-cols-[1fr_auto]">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-ink px-3 py-1 text-xs font-semibold text-white">
                      Célula {report.cells?.code || "—"}
                    </span>
                    <span className="rounded-full bg-orange/15 px-3 py-1 text-xs font-semibold text-orange-deep">
                      Semana {report.week} · {report.year}
                    </span>
                    <span className="text-xs text-muted">
                      {report.meeting_date || (report.met ? "Fecha no registrada" : "No se reunió")}
                    </span>
                  </div>
                  <h2 className="mt-5 text-2xl font-medium tracking-tight">
                    {report.met ? report.theme_title || "Tema sin título" : "La célula no se reunió"}
                  </h2>
                  <p className="mt-2 text-sm text-muted">
                    Subido por <strong className="font-semibold text-ink">{leader}</strong>
                    {profile?.username ? ` · Usuario ${profile.username}` : ""}
                    {report.modality ? ` · ${report.modality === "virtual" ? "Virtual" : "Presencial"}` : ""}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:min-w-[440px]">
                  {[
                    ["Asistencia", attendance],
                    ["Salvos", report.salvations || 0],
                    ["Familias", report.families || 0],
                    [showMoney ? "Ofrenda" : "Reunión", showMoney ? `S/ ${Number(report.offering || 0).toFixed(2)}` : report.met ? "Realizada" : "No realizada"],
                  ].map(([label, value]) => (
                    <div key={String(label)} className="rounded-2xl bg-paper px-4 py-3">
                      <p className="text-xs text-muted">{label}</p>
                      <p className="mt-1 text-lg font-semibold">{value}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-line bg-white/70 p-6">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className="font-semibold">Evidencias fotográficas</h3>
                    <p className="mt-1 text-xs text-muted">
                      {photos.length ? `${photos.length} archivo${photos.length === 1 ? "" : "s"} subido${photos.length === 1 ? "" : "s"} por este usuario` : "Este informe no tiene imágenes"}
                    </p>
                  </div>
                  {photos.length > 0 && (
                    <span className="rounded-full border border-line px-3 py-1 text-xs text-muted">
                      Descarga individual
                    </span>
                  )}
                </div>
                {photos.length > 0 && (
                  <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    {photos.map((photo, index) => (
                      <div key={photo.id} className="group overflow-hidden rounded-2xl border border-line bg-card">
                        {photo.previewUrl ? (
                          <img src={photo.previewUrl} alt={`Evidencia ${index + 1} de ${leader}`} className="aspect-[4/3] w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
                        ) : (
                          <div className="flex aspect-[4/3] items-center justify-center bg-paper text-sm text-muted">Vista no disponible</div>
                        )}
                        <div className="flex items-center justify-between gap-3 p-3">
                          <p className="min-w-0 truncate text-xs text-muted" title={photo.fileName}>{photo.fileName}</p>
                          {photo.downloadUrl && (
                            <a
                              href={photo.downloadUrl}
                              download={photo.fileName}
                              className="shrink-0 rounded-full bg-ink px-3 py-2 text-xs font-semibold text-white transition hover:bg-orange-deep"
                            >
                              Descargar
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </article>
          );
        })}
        {!rows.length && (
          <div className="rounded-[1.75rem] border border-dashed border-line bg-card px-6 py-16 text-center">
            <p className="text-lg font-medium">Todavía no hay informes.</p>
            <p className="mt-2 text-sm text-muted">Los informes enviados por los líderes aparecerán aquí.</p>
          </div>
        )}
      </div>
    </div>
  );
}
