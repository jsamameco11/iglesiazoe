import { CellsManager } from "@/Components/admin/cells-manager";
import { PageHeader } from "@/Components/admin/ui";
import AdminLayout from "@/Layouts/AdminLayout";
import type { Cell, Member } from "@/lib/types";

export default function Celulas({ networks, cells, members }: { networks: { id: string; code: string; name: string }[]; cells: Cell[]; members: Member[] }) {
  return (
    <AdminLayout>
      <div className="pb-16">
        <PageHeader
          kicker="Células"
          title="Células e integrantes"
          text="Datos de cada célula y su lista de integrantes. Las células nuevas se abren al crear un Servidor Base, hijo o subhijo en «Servidores»."
        />
        <div className="mt-7">
          <CellsManager networks={networks} cells={cells} members={members} />
        </div>
      </div>
    </AdminLayout>
  );
}
