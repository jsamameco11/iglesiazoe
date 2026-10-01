
import { useState, useTransition } from "react";
import { addMember, createDaughter, createRootCell, ensureSixCells, removeMember, saveCell } from "@/lib/actions";
import type { Cell, Member } from "@/lib/types";

export function CellsManager({
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
  const [red, setRed] = useState(networks.find((item) => item.code === "G")?.code || networks[0]?.code || "A");
  const [message, setMessage] = useState("");
  const [pending, start] = useTransition();
  const network = networks.find((item) => item.code === red);
  const list = cells.filter((cell) => cell.network_id === network?.id);
  const roots = list.filter((cell) => !cell.parent_id).sort((a, b) => a.number - b.number);
  const ordered = roots.flatMap((root) => [root, ...list.filter((cell) => cell.parent_id === root.id)]);

  function run(task: () => Promise<{ error?: string; ok?: boolean; code?: string; created?: number }>) {
    start(async () => {
      const result = await task();
      setMessage(result.error || (result.code ? `Lista: ${result.code}` : result.created != null ? `Células nuevas: ${result.created}` : "Listo."));
    });
  }

  return (
    <div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">Red
          <select value={red} onChange={(event) => setRed(event.target.value)} className="mt-1 block rounded-xl border border-line px-3 py-2">
            {networks.map((item) => <option key={item.id}>{item.code}</option>)}
          </select>
        </label>
        {network && (
          <>
            <button disabled={pending} onClick={() => run(() => ensureSixCells(network.id, network.code))} className="rounded-full bg-accent px-4 py-2 text-sm text-white">Asegurar 6 células</button>
            <button disabled={pending} onClick={() => run(() => createRootCell(network.id, network.code))} className="rounded-full border border-line px-4 py-2 text-sm">Agregar célula</button>
          </>
        )}
      </div>
      {message && <p className="mt-3 text-sm text-muted">{message}</p>}
      <div className="mt-6 space-y-4">
        {ordered.map((cell) => (
          <details key={cell.id} className="rounded-[1.5rem] border border-line bg-card p-4" open={cell.code === "05G"}>
            <summary className="cursor-pointer text-lg font-medium">{cell.code} · {cell.leader_name || "Sin líder"}{cell.parent_id ? " · hija" : ""}</summary>
            <form action={saveCell} className="mt-4 grid gap-3 md:grid-cols-2">
              <input type="hidden" name="id" value={cell.id} />
              <input name="leader_name" defaultValue={cell.leader_name || ""} placeholder="Líder" className="rounded-xl border border-line px-3 py-2" />
              <input name="assistant_name" defaultValue={cell.assistant_name || ""} placeholder="Líder ayudante" className="rounded-xl border border-line px-3 py-2" />
              <input name="host_name" defaultValue={cell.host_name || ""} placeholder="Anfitrión" className="rounded-xl border border-line px-3 py-2" />
              <input name="address" defaultValue={cell.address || ""} placeholder="Dirección" className="rounded-xl border border-line px-3 py-2" />
              <select name="meeting_day" defaultValue={cell.meeting_day || ""} className="rounded-xl border border-line px-3 py-2">
                <option value="">Día de reunión</option>
                {["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"].map((day) => <option key={day}>{day}</option>)}
              </select>
              <input type="time" name="meeting_time" defaultValue={(cell.meeting_time || "").slice(0, 5)} className="rounded-xl border border-line px-3 py-2" />
              <label className="text-sm"><input type="checkbox" name="active" defaultChecked={cell.active} /> Activa</label>
              <button className="w-fit rounded-full bg-accent px-4 py-2 text-sm text-white">Guardar célula</button>
            </form>
            {!cell.parent_id && network && (
              <button className="mt-3 text-sm text-orange-deep" onClick={() => run(() => createDaughter(cell.id, cell.code, network.id))}>Crear célula hija</button>
            )}
            <div className="mt-4">
              <p className="text-sm font-medium">Integrantes</p>
              <ul className="mt-2 space-y-1 text-sm">
                {members.filter((member) => member.cell_id === cell.id && member.active).map((member) => (
                  <li key={member.id} className="flex items-center justify-between">
                    <span>{member.full_name}</span>
                    {canManageMembers && (
                      <button className="text-red-700" onClick={() => run(async () => { await removeMember(member.id); return { ok: true }; })}>Quitar</button>
                    )}
                  </li>
                ))}
              </ul>
              {canManageMembers ? (
                <form action={addMember} className="mt-3 flex gap-2">
                  <input type="hidden" name="cell_id" value={cell.id} />
                  <input name="full_name" placeholder="Nombre" className="flex-1 rounded-xl border border-line px-3 py-2" />
                  <input name="phone" placeholder="Teléfono" className="w-36 rounded-xl border border-line px-3 py-2" />
                  <button className="rounded-full border border-line px-3 text-sm">Agregar</button>
                </form>
              ) : (
                <p className="mt-3 text-sm text-muted">El superadministrador no habilitó agregar integrantes.</p>
              )}
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
