import { useState } from "react";
import { ghost } from "@/Components/admin/ui";
import { CellCode } from "@/Components/ui/cell-code";
import { AccountForm, ServerForm } from "./server-form";
import { countOf, levels, type ServerLevel, type ServerNode } from "./types";

export function LevelBadge({ level, children }: { level: ServerLevel; children?: React.ReactNode }) {
  return <span className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[10.5px] font-semibold ${levels[level].tone}`}>{children ?? levels[level].label}</span>;
}

/** Branch line under a server, in the color its children's codes use. */
const branch: Partial<Record<ServerLevel, string>> = {
  hijo: "border-accent/35",
  subhijo: "border-clay-deep/35",
};

export function ServerCard({ server }: { server: ServerNode }) {
  return (
    <article className={`rounded-[1.4rem] border bg-white p-4 md:p-5 ${server.active ? "border-line" : "border-dashed border-line opacity-70"}`}>
      <ServerBranch server={server} />
    </article>
  );
}

function ServerBranch({ server }: { server: ServerNode }) {
  const [adding, setAdding] = useState(false);
  const childLevel = server.child_level;

  return (
    <div>
      <ServerRow server={server} />
      {server.children.length > 0 && (
        <ul className={`mt-4 space-y-3 border-l-2 pl-4 md:ml-4 ${branch[server.children[0].level] ?? "border-line"}`}>
          {server.children.map((child) => (
            <li key={child.id} className={child.active ? "" : "opacity-70"}>
              <ServerBranch server={child} />
            </li>
          ))}
        </ul>
      )}
      {server.can_add_child && childLevel && (
        <div className="mt-4 md:ml-4">
          {adding ? (
            <ServerForm
              inline
              level={childLevel}
              title={`Nuevo ${levels[childLevel].one} de ${server.code}`}
              text={`Se crea la célula ${server.next_child_code}: su número va delante del código de ${server.code}.`}
              url="/admin/servidores/hijo"
              hidden={{ parent_id: server.id }}
              submitLabel={`Crear ${levels[childLevel].one}`}
              onCancel={() => setAdding(false)}
              onDone={() => setAdding(false)}
            />
          ) : (
            <button type="button" onClick={() => setAdding(true)} className={`${ghost} py-1.5 text-xs`}>+ Añadir {levels[childLevel].one}</button>
          )}
        </div>
      )}
    </div>
  );
}

function ServerRow({ server }: { server: ServerNode }) {
  const [giving, setGiving] = useState(false);
  const schedule = [server.meeting_day, server.meeting_time].filter(Boolean).join(" · ") || "Horario por definir";
  const main = server.level === "servidor" || server.level === "red";
  const below = server.child_level ? countOf(server.totals.children, server.child_level) : null;
  const deeper = server.level === "servidor" && server.totals.descendants > server.totals.children ? countOf(server.totals.descendants - server.totals.children, "subhijo") : null;

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className={`grid shrink-0 place-items-center rounded-xl border border-line bg-paper text-ink ${main ? "h-11 min-w-11 px-2.5 text-sm" : "h-9 min-w-9 px-2 text-xs"}`}>
            <CellCode code={server.code} level={server.level} className="tracking-[-0.01em]" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className={`font-semibold tracking-[-0.02em] ${main ? "text-base" : "text-sm"}`}>{server.leader_name || "Sin nombre"}</p>
              <LevelBadge level={server.level} />
              {server.own && <span className="rounded-full bg-amber px-2.5 py-1 text-[10.5px] font-semibold text-ink">Tu célula</span>}
              {!server.active && <span className="rounded-full bg-red-50 px-2.5 py-1 text-[10.5px] font-semibold text-red-700">Inactiva</span>}
            </div>
            <p className="mt-0.5 text-xs text-muted">
              {schedule}
              {below && ` · ${below}`}
              {deeper && ` · ${deeper}`}
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
