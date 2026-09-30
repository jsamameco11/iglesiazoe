import { InformeForm } from "@/components/portal/informe-form";
import { isStaff } from "@/lib/access";
import { getSession } from "@/lib/session";
import { currentWeek } from "@/lib/weeks";
import type { Cell } from "@/lib/types";

export default async function InformePage() {
  const { supabase, profile } = await getSession();
  const { year, week } = currentWeek();
  let cells: Cell[] = [];
  if (isStaff(profile?.role)) {
    const { data } = await supabase.from("cells").select("*").eq("active", true).order("code");
    cells = (data || []) as Cell[];
  } else {
    const { data } = await supabase.from("user_cells").select("cells(*)").eq("user_id", profile!.id);
    cells = (data || []).map((row) => row.cells).filter(Boolean) as unknown as Cell[];
  }
  return (
    <div>
      <h1 className="display text-4xl">Informe semanal</h1>
      <p className="mt-2 text-muted">Elige la célula y la semana. El informe queda guardado para tu historial y el seguimiento de la red.</p>
      {cells.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-line bg-card p-6">Tu usuario todavía no tiene una célula asignada. Pídele al administrador que te la asigne.</p>
      ) : (
        <div className="mt-6"><InformeForm cells={cells} year={year} week={week} /></div>
      )}
    </div>
  );
}
