import { useState } from "react";
import { Panel, ghost } from "@/Components/admin/ui";
import { LevelBadge } from "./server-card";
import { ServerForm } from "./server-form";
import type { ServerNetwork } from "./types";

export function NetworkLeaders({ network, canAssign }: { network: ServerNetwork; canAssign: boolean }) {
  const [adding, setAdding] = useState(false);
  const empty = network.leaders.length === 0;

  return (
    <Panel
      title={`Servidor de Red · Red ${network.code}`}
      text="Responsable de toda la red: abre los servidores y revisa sus informes."
      actions={canAssign && !empty && !adding && <button type="button" onClick={() => setAdding(true)} className={`${ghost} py-1.5 text-xs`}>+ Añadir otro</button>}
    >
      <div className="space-y-3">
        {network.leaders.map((leader) => (
          <div key={leader.id} className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-white px-4 py-3 ${leader.active ? "border-line" : "border-dashed border-line opacity-70"}`}>
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-sky text-sm font-semibold text-[#28516b]">{network.code}</span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-base font-semibold tracking-[-0.02em]">{leader.name}</p>
                  <LevelBadge level="red" />
                </div>
                <p className="mt-0.5 text-xs text-muted">Usuario {leader.username}{leader.active ? "" : " · cuenta desactivada"}</p>
              </div>
            </div>
          </div>
        ))}
        {empty && !adding && (
          <div className="rounded-2xl border border-dashed border-line px-5 py-6 text-center">
            <p className="text-sm font-semibold">La Red {network.code} todavía no tiene Servidor de Red.</p>
            <p className="mt-1 text-xs text-muted">{canAssign ? "Asígnalo para que pueda abrir servidores en su red." : "El superadministrador lo asigna."}</p>
            {canAssign && <button type="button" onClick={() => setAdding(true)} className={`${ghost} mt-4 py-1.5 text-xs`}>Asignar Servidor de Red</button>}
          </div>
        )}
        {adding && (
          <ServerForm
            inline
            level="red"
            title={`Servidor de Red de la Red ${network.code}`}
            text="Se crea su cuenta con acceso a toda la red."
            url="/admin/servidores/red"
            hidden={{ network_id: network.id }}
            submitLabel="Asignar"
            onCancel={() => setAdding(false)}
            onDone={() => setAdding(false)}
          />
        )}
      </div>
    </Panel>
  );
}
