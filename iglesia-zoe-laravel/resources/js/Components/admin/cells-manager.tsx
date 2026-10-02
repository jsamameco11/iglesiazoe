import { useState, useTransition } from "react";
import { Link } from "@inertiajs/react";
import { addMember, removeMember, saveCell } from "@/lib/actions";
import { WEEKDAYS } from "@/lib/next-service";
import type { Cell, Member } from "@/lib/types";

const field = "rounded-xl border border-line bg-white px-3 py-2 text-sm";

export function CellsManager({ networks, cells, members }: { networks: { id: string; code: string; name: string }[]; cells: Cell[]; members: Member[] }) {
  const [networkId, setNetworkId] = useState(networks[0]?.id ?? "");
  const [message, setMessage] = useState("");
  const [, start] = useTransition();
  const list = cells.filter((cell) => cell.network_id === networkId);
  const ids = new Set(list.map((cell) => cell.id));
  const tree = (parentId: string | null, depth: number): { cell: Cell; depth: number }[] =>
    list
      .filter((cell) => (parentId === null ? !cell.parent_id || !ids.has(cell.parent_id) : cell.parent_id === parentId))
      .sort((a, b) => a.number - b.number)
      .flatMap((cell) => [{ cell, depth }, ...tree(cell.id, depth + 1)]);
  const ordered = tree(null, 0);

  function run(task: () => Promise<void>) {
    start(async () => {
      try {
        await task();
        setMessage("");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "No se pudo guardar.");
      }
    });
  }

  return (
    <div>
      {networks.length > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          {networks.map((item) => (
            <button key={item.id} type="button" onClick={() => setNetworkId(item.id)} className={`rounded-full px-4 py-2 text-sm font-semibold transition ${item.id === networkId ? "bg-ink text-white" : "bg-white text-muted hover:text-ink"}`}>
              Red {item.code}
            </button>
          ))}
        </div>
      )}
      {message && <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-800">{message}</p>}
      <div className="mt-6 space-y-3">
        {ordered.map(({ cell, depth }) => (
          <details key={cell.id} className="rounded-[1.5rem] border border-line bg-card p-4" style={{ marginLeft: depth * 24 }}>
            <summary className="cursor-pointer text-base font-semibold tracking-[-0.02em]">
              {cell.code} · {cell.leader_name || "Sin servidor"}
              <span className="ml-2 text-xs font-normal text-muted">{cell.parent_id ? "Servidor hijo" : "Servidor"}{cell.active ? "" : " · inactiva"}</span>
            </summary>
            <form action={(data) => run(() => saveCell(data))} className="mt-4 grid gap-3 md:grid-cols-2">
              <input type="hidden" name="id" value={cell.id} />
              <input name="leader_name" defaultValue={cell.leader_name || ""} placeholder="Servidor" className={field} />
              <input name="assistant_name" defaultValue={cell.assistant_name || ""} placeholder="Servidor ayudante" className={field} />
              <input name="host_name" defaultValue={cell.host_name || ""} placeholder="Anfitrión" className={field} />
              <input name="address" defaultValue={cell.address || ""} placeholder="Dirección" className={field} />
              <select name="meeting_day" defaultValue={cell.meeting_day || ""} className={field}>
                <option value="">Día de reunión</option>
                {WEEKDAYS.map((day) => <option key={day}>{day}</option>)}
              </select>
              <input type="time" name="meeting_time" defaultValue={(cell.meeting_time || "").slice(0, 5)} className={field} />
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={cell.active} className="h-4 w-4 accent-ink" /> Activa</label>
              <button className="w-fit rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white">Guardar célula</button>
            </form>
            <div className="mt-5 border-t border-line pt-4">
              <p className="text-sm font-semibold">Integrantes</p>
              <ul className="mt-2 space-y-1 text-sm">
                {members.filter((member) => member.cell_id === cell.id && member.active).map((member) => (
                  <li key={member.id} className="flex items-center justify-between">
                    <span>{member.full_name}{member.phone ? <span className="ml-2 text-xs text-muted">{member.phone}</span> : null}</span>
                    <button type="button" className="text-xs font-semibold text-red-700" onClick={() => run(() => removeMember(member.id))}>Quitar</button>
                  </li>
                ))}
              </ul>
              <form action={(data) => run(() => addMember(data))} className="mt-3 flex flex-wrap gap-2">
                <input type="hidden" name="cell_id" value={cell.id} />
                <input name="full_name" required placeholder="Nombre" className={`${field} min-w-40 flex-1`} />
                <input name="phone" placeholder="Teléfono" className={`${field} w-36`} />
                <button className="rounded-full border border-line bg-white px-4 text-sm font-semibold">Agregar</button>
              </form>
            </div>
          </details>
        ))}
        {!ordered.length && (
          <p className="rounded-2xl border border-dashed border-line px-5 py-10 text-center text-sm text-muted">
            Aún no hay células. Se abren al crear un servidor en <Link href="/admin/servidores" className="font-semibold text-ink underline">Servidores</Link>.
          </p>
        )}
      </div>
    </div>
  );
}
