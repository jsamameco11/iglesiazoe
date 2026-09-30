import { CellsManager } from "@/components/admin/cells-manager";
import { getCapabilities, isSuperadmin } from "@/lib/access";
import { getSession } from "@/lib/session";
import type { Cell, Member } from "@/lib/types";

export default async function CellsAdmin() {
  const { supabase, profile } = await getSession();
  const capabilities = await getCapabilities(supabase, profile?.role);
  const [{ data: networks }, { data: cells }, { data: members }] = await Promise.all([
    supabase.from("networks").select("id, code, name").order("code"),
    supabase.from("cells").select("*").order("code"),
    supabase.from("cell_members").select("*").eq("active", true).order("full_name"),
  ]);
  return (
    <div>
      <h1 className="display text-4xl">Células y redes</h1>
      <p className="mt-2 mb-6 max-w-2xl text-muted">
        Redes de la A a la L. Por defecto cada red tiene seis células: 01A, 02A… Una hija de 06A se llama 0106A: la primera célula hija de 06A.
      </p>
      <CellsManager
        networks={networks || []}
        cells={(cells || []) as Cell[]}
        members={(members || []) as Member[]}
        canManageMembers={isSuperadmin(profile?.role) || capabilities.manageMembers}
      />
    </div>
  );
}
