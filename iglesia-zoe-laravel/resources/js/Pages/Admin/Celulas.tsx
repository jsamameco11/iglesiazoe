import { CellsManager } from "@/Components/admin/cells-manager";
import AdminLayout from "@/Layouts/AdminLayout";
import type { Cell, Member } from "@/lib/types";

export default function Celulas({
  networks,
  cells,
  members,
  canManageMembers,
}: {
  networks: { id: string; code: string; name: string }[];
  cells: Cell[];
  members: Member[];
  canManageMembers: boolean;
}) {
  return (
    <AdminLayout>
      <h1 className="display text-4xl">Células y redes</h1>
      <p className="mt-2 mb-6 max-w-2xl text-muted">
        Redes de la A a la L. Por defecto cada red tiene seis células: 01A, 02A… Una hija de 06A se llama 0106A.
      </p>
      <CellsManager networks={networks} cells={cells} members={members} canManageMembers={canManageMembers} />
    </AdminLayout>
  );
}
