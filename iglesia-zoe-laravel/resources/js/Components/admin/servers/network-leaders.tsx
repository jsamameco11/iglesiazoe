import { useState } from "react";
import { Notice, Panel, button, ghost, input, useAction } from "@/Components/admin/ui";
import { send } from "@/lib/actions";
import { LevelBadge } from "./server-card";
import { ServerForm } from "./server-form";
import type { NetworkLeader, ServerNetwork } from "./types";

/** Usually one Servidor de Red per network, never more than `limit` active at once. */
export function NetworkLeaders({ network, limit }: { network: ServerNetwork; limit: number }) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const manage = network.can_manage_leaders;
  const active = network.leaders.filter((leader) => leader.active).length;
  const full = active >= limit;
  const empty = network.leaders.length === 0;
  const busy = adding || editing !== null;

  return (
    <Panel
      title={`${network.leaders.length > 1 ? "Servidores de Red" : "Servidor de Red"} · Red ${network.code}`}
      text={`Responsable de toda la red: abre los servidores y revisa sus informes. Cada red tiene uno, o ${limit} como máximo.`}
      actions={
        manage && !empty && (
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-paper px-2.5 py-1 text-[11px] font-semibold text-muted">{active} de {limit}</span>
            {!full && !busy && <button type="button" onClick={() => setAdding(true)} className={`${ghost} py-1.5 text-xs`}>+ Añadir otro</button>}
          </div>
        )
      }
    >
      <div className="space-y-3">
        {network.leaders.map((leader) =>
          editing === leader.id ? (
            <LeaderForm key={leader.id} leader={leader} canActivate={!full} onClose={() => setEditing(null)} />
          ) : (
            <LeaderRow key={leader.id} code={network.code} leader={leader} onEdit={manage && !busy ? () => setEditing(leader.id) : undefined} />
          ),
        )}
        {empty && !adding && (
          <div className="rounded-2xl border border-dashed border-line px-5 py-6 text-center">
            <p className="text-sm font-semibold">La Red {network.code} todavía no tiene Servidor de Red.</p>
            <p className="mt-1 text-xs text-muted">{manage ? "Asígnalo para que pueda abrir servidores en su red." : "El superadministrador lo asigna."}</p>
            {manage && <button type="button" onClick={() => setAdding(true)} className={`${ghost} mt-4 py-1.5 text-xs`}>Asignar Servidor de Red</button>}
          </div>
        )}
        {manage && full && !busy && (
          <p className="text-[11.5px] leading-4 text-muted">La red ya tiene {limit} Servidores de Red activos. Para asignar otro, desactiva primero a uno.</p>
        )}
        {adding && (
          <ServerForm
            inline
            level="red"
            title={empty ? `Servidor de Red de la Red ${network.code}` : `Segundo Servidor de Red · Red ${network.code}`}
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

function LeaderRow({ code, leader, onEdit }: { code: string; leader: NetworkLeader; onEdit?: () => void }) {
  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-white px-4 py-3 ${leader.active ? "border-line" : "border-dashed border-line opacity-70"}`}>
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-sky text-sm font-semibold text-[#28516b]">{code}</span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-base font-semibold tracking-[-0.02em]">{leader.name}</p>
            <LevelBadge level="red" />
          </div>
          <p className="mt-0.5 text-xs text-muted">Usuario {leader.username}{leader.active ? "" : " · cuenta desactivada"}</p>
        </div>
      </div>
      {onEdit && <button type="button" onClick={onEdit} className={`${ghost} py-1.5 text-xs`}>Editar</button>}
    </div>
  );
}

function LeaderForm({ leader, canActivate, onClose }: { leader: NetworkLeader; canActivate: boolean; onClose: () => void }) {
  const { result, setResult, pending, run } = useAction();
  const [active, setActive] = useState(leader.active);
  const locked = leader.me || (!leader.active && !canActivate);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    data.set("id", leader.id);
    data.set("active", active ? "1" : "0");
    run(() => send("/admin/servidores/red/actualizar", data), onClose);
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-2xl border border-line bg-paper/60 p-4">
      <p className="text-sm font-semibold">Editar Servidor de Red</p>
      <label className="block text-xs font-semibold text-muted">Nombre completo<input name="name" required maxLength={120} defaultValue={leader.name} className={input} /></label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-semibold text-muted">Usuario o DNI<input name="username" required defaultValue={leader.username} className={input} autoComplete="off" /></label>
        <label className="text-xs font-semibold text-muted">Nueva clave<input name="password" type="text" minLength={6} className={input} placeholder="Déjala vacía para no cambiarla" autoComplete="new-password" /></label>
      </div>
      <label className={`flex items-start gap-2.5 rounded-xl bg-white px-3.5 py-3 text-sm ${locked ? "opacity-60" : ""}`}>
        <input type="checkbox" checked={active} disabled={locked} onChange={(event) => setActive(event.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--color-accent)]" />
        <span>
          <span className="block font-semibold">Cuenta activa</span>
          <span className="block text-[11.5px] leading-4 text-muted">
            {leader.me
              ? "Es tu cuenta: no puedes desactivarla tú mismo."
              : !leader.active && !canActivate
                ? "La red ya tiene sus Servidores de Red activos. Desactiva a otro antes de reactivar esta cuenta."
                : "Desactivada, no puede ingresar y deja libre su lugar en la red."}
          </span>
        </span>
      </label>
      <Notice result={result} onClose={() => setResult(null)} />
      <div className="flex flex-wrap items-center gap-3">
        <button disabled={pending} className={button}>{pending ? "Guardando…" : "Guardar"}</button>
        <button type="button" onClick={onClose} className="text-sm font-semibold text-muted hover:text-ink">Cancelar</button>
      </div>
    </form>
  );
}
