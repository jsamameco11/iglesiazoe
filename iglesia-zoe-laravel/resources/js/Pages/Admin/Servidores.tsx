import { useState } from "react";
import AdminLayout from "@/Layouts/AdminLayout";
import { Notice, PageHeader, Panel, button, ghost, input, useAction } from "@/Components/admin/ui";
import { send } from "@/lib/actions";

type Network = { id: string; code: string; name: string };
type CellRow = {
  id: string;
  network_id: string;
  parent_id: string | null;
  code: string;
  number: number;
  leader_name: string | null;
  meeting_day: string | null;
  meeting_time: string | null;
  active: boolean;
  accounts: { username: string; name: string }[];
};

const days = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

export default function Servidores({ networks, cells }: { networks: Network[]; cells: CellRow[] }) {
  const [networkId, setNetworkId] = useState(networks[0]?.id ?? "");
  const [parent, setParent] = useState<CellRow | null>(null);
  const network = networks.find((item) => item.id === networkId);
  const list = cells.filter((cell) => cell.network_id === networkId);
  const tree = (parentId: string | null, depth: number): { cell: CellRow; depth: number }[] =>
    list
      .filter((cell) => cell.parent_id === parentId)
      .sort((a, b) => a.number - b.number)
      .flatMap((cell) => [{ cell, depth }, ...tree(cell.id, depth + 1)]);
  const ordered = tree(null, 0);

  return (
    <AdminLayout>
      <div className="pb-16">
        <PageHeader
          kicker="Células"
          title="Servidores y servidores hijo"
          text="Abre una célula nueva con su servidor, o una célula hija debajo de otra. Si escribes un usuario y una clave, el servidor recibe su propia cuenta para subir informes."
        />
        <div className="mt-7 flex flex-wrap items-center gap-2">
          {networks.map((item) => (
            <button key={item.id} type="button" onClick={() => { setNetworkId(item.id); setParent(null); }} className={`rounded-full px-4 py-2 text-sm font-semibold transition ${item.id === networkId ? "bg-ink text-white" : "bg-white text-muted hover:text-ink"}`}>
              Red {item.code}
            </button>
          ))}
        </div>
        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="space-y-6">
            {network && (
              <ServerForm
                key={`root-${network.id}`}
                title={`Nuevo servidor · Red ${network.code}`}
                text={`Se crea la célula ${String(list.filter((cell) => !cell.parent_id).reduce((max, cell) => Math.max(max, cell.number), 0) + 1).padStart(2, "0")}${network.code}.`}
                url="/admin/servidores"
                hidden={{ network_id: network.id }}
              />
            )}
            {parent ? (
              <ServerForm
                key={`child-${parent.id}`}
                title={`Nuevo servidor hijo de ${parent.code}`}
                text={`Se crea la célula ${String(list.filter((cell) => cell.parent_id === parent.id).reduce((max, cell) => Math.max(max, cell.number), 0) + 1).padStart(2, "0")}${parent.code}.`}
                url="/admin/servidores/hijo"
                hidden={{ parent_id: parent.id }}
                onCancel={() => setParent(null)}
              />
            ) : (
              <Panel title="Servidor hijo" text="Elige en la lista la célula madre y pulsa «Crear hijo».">
                <p className="text-sm text-muted">Una célula hija de 01{network?.code} se llama 0101{network?.code}.</p>
              </Panel>
            )}
          </div>
          <Panel title={`Células de la Red ${network?.code ?? ""}`} text={`${list.length} células · ${list.filter((cell) => cell.parent_id).length} hijas`}>
            <div className="divide-y divide-line">
              {ordered.map(({ cell, depth }) => (
                <div key={cell.id} className="flex flex-wrap items-center justify-between gap-3 py-3" style={{ paddingLeft: depth * 22 }}>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">
                      {depth > 0 && <span className="mr-1.5 text-muted">↳</span>}
                      {cell.code}
                      <span className="ml-2 font-normal text-muted">{cell.leader_name || "Sin servidor asignado"}</span>
                    </p>
                    <p className="mt-0.5 text-xs text-muted">
                      {[cell.meeting_day, cell.meeting_time?.slice(0, 5)].filter(Boolean).join(" · ") || "Horario por definir"}
                      {cell.accounts.length ? ` · Cuenta: ${cell.accounts.map((account) => account.username).join(", ")}` : " · Sin cuenta"}
                    </p>
                  </div>
                  <button type="button" onClick={() => setParent(cell)} className={`${ghost} py-1.5 text-xs ${parent?.id === cell.id ? "border-ink" : ""}`}>Crear hijo</button>
                </div>
              ))}
              {!ordered.length && <p className="py-8 text-center text-sm text-muted">Esta red todavía no tiene células.</p>}
            </div>
          </Panel>
        </div>
      </div>
    </AdminLayout>
  );
}

function ServerForm({ title, text, url, hidden, onCancel }: { title: string; text: string; url: string; hidden: Record<string, string>; onCancel?: () => void }) {
  const { result, setResult, pending, run } = useAction();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    Object.entries(hidden).forEach(([key, value]) => data.set(key, value));
    run(() => send(url, data), () => form.reset());
  }

  return (
    <Panel title={title} text={text} actions={onCancel && <button type="button" onClick={onCancel} className="text-sm text-muted">Cancelar</button>}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-xs font-semibold text-muted sm:col-span-3">Nombre del servidor<input name="leader_name" required className={input} placeholder="Ej. Juan Pérez" /></label>
          <label className="text-xs font-semibold text-muted">Día
            <select name="meeting_day" className={input} defaultValue=""><option value="">Por definir</option>{days.map((day) => <option key={day}>{day}</option>)}</select>
          </label>
          <label className="text-xs font-semibold text-muted">Hora<input type="time" name="meeting_time" className={input} /></label>
        </div>
        <div className="rounded-2xl border border-line bg-white p-4">
          <p className="text-xs font-semibold text-muted">Cuenta del servidor (opcional)</p>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <input name="username" className={input} placeholder="Usuario o DNI" autoComplete="off" />
            <input name="password" type="text" className={input} placeholder="Clave (mínimo 6)" autoComplete="new-password" />
          </div>
          <p className="mt-2 text-[11.5px] text-muted">Podrá subir sus informes, ver el reporte semanal y crear sus propios servidores hijo.</p>
        </div>
        <Notice result={result} onClose={() => setResult(null)} />
        <button disabled={pending} className={button}>{pending ? "Creando…" : "Crear"}</button>
      </form>
    </Panel>
  );
}
