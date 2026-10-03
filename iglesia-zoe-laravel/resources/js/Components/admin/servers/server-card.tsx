import { useState } from "react";
import { ghost } from "@/Components/admin/ui";
import { AccountForm, ServerForm } from "./server-form";
import { levels, type ServerLevel, type ServerNode } from "./types";

export function LevelBadge({ level, children }: { level: ServerLevel; children?: React.ReactNode }) {
  return <span className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[10.5px] font-semibold ${levels[level].tone}`}>{children ?? levels[level].label}</span>;
}

export function ServerCard({ server }: { server: ServerNode }) {
  const [adding, setAdding] = useState(false);

  return (
    <article className={`rounded-[1.4rem] border bg-white p-4 md:p-5 ${server.active ? "border-line" : "border-dashed border-line opacity-70"}`}>
      <ServerRow server={server} />
      {server.children.length > 0 && (
        <ul className="mt-4 space-y-3 border-l-2 border-line pl-4 md:ml-4">
          {server.children.map((child) => (
            <li key={child.id}>
              <ServerRow server={child} />
            </li>
          ))}
        </ul>
      )}
      {server.can_add_child && (
        <div className="mt-4 md:ml-4">
          {adding ? (
            <ServerForm
              inline
              level="hijo"
              title={`Nuevo servidor hijo de ${server.code}`}
              text={`Se crea la célula ${server.next_child_code}.`}
              url="/admin/servidores/hijo"
              hidden={{ parent_id: server.id }}
              submitLabel="Crear servidor hijo"
              onCancel={() => setAdding(false)}
              onDone={() => setAdding(false)}
            />
          ) : (
            <button type="button" onClick={() => setAdding(true)} className={`${ghost} py-1.5 text-xs`}>+ Añadir servidor hijo</button>
          )}
        </div>
      )}
    </article>
  );
}

function ServerRow({ server }: { server: ServerNode }) {
  const [giving, setGiving] = useState(false);
  const schedule = [server.meeting_day, server.meeting_time].filter(Boolean).join(" · ") || "Horario por definir";
  const main = server.level !== "hijo";

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className={`grid shrink-0 place-items-center rounded-xl font-semibold tracking-[-0.02em] ${main ? "h-11 min-w-11 bg-ink px-2 text-sm text-white" : "h-9 min-w-9 bg-paper px-2 text-xs text-ink"}`}>{server.code}</span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className={`font-semibold tracking-[-0.02em] ${main ? "text-base" : "text-sm"}`}>{server.leader_name || "Sin nombre"}</p>
              <LevelBadge level={server.level} />
              {server.own && <span className="rounded-full bg-amber px-2.5 py-1 text-[10.5px] font-semibold text-ink">Tu célula</span>}
              {!server.active && <span className="rounded-full bg-red-50 px-2.5 py-1 text-[10.5px] font-semibold text-red-700">Inactiva</span>}
            </div>
            <p className="mt-0.5 text-xs text-muted">
              {schedule}
              {server.level === "servidor" && ` · ${server.totals.children} ${server.totals.children === 1 ? "servidor hijo" : "servidores hijo"}`}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {server.accounts.map((account) => (
            <span key={account.username} title={account.name} className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${account.active ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>
              Cuenta: {account.username}
            </span>
          ))}
          {!server.accounts.length && <span className="rounded-full bg-paper px-2.5 py-1 text-[11px] text-muted">Sin cuenta</span>}
          {server.can_give_account && !giving && (
            <button type="button" onClick={() => setGiving(true)} className="rounded-full px-2.5 py-1 text-[11px] font-semibold text-orange-deep hover:bg-paper">Crear cuenta</button>
          )}
        </div>
      </div>
      {giving && <AccountForm cellId={server.id} level={server.level} onCancel={() => setGiving(false)} />}
    </div>
  );
}
