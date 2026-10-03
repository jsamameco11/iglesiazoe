import { useState } from "react";
import AdminLayout from "@/Layouts/AdminLayout";
import { PageHeader, Panel } from "@/Components/admin/ui";
import { NetworkLeaders } from "@/Components/admin/servers/network-leaders";
import { OwnCellPanel } from "@/Components/admin/servers/own-cell";
import { LevelBadge, ServerCard } from "@/Components/admin/servers/server-card";
import { ServerForm } from "@/Components/admin/servers/server-form";
import type { OwnCell, ServerNetwork } from "@/Components/admin/servers/types";

type Props = { networks: ServerNetwork[]; canAssignLeaders: boolean; leadsNetwork: boolean; ownCell: OwnCell | null };

export default function Servidores({ networks, canAssignLeaders, leadsNetwork, ownCell }: Props) {
  const [networkId, setNetworkId] = useState(networks[0]?.id ?? "");
  const network = networks.find((item) => item.id === networkId) ?? networks[0];

  return (
    <AdminLayout>
      <div className="pb-16">
        <PageHeader
          kicker="Células"
          title={leadsNetwork ? "Servidores" : "Mis servidores hijo"}
          text={
            leadsNetwork
              ? "Cada red tiene su Servidor de Red. Debajo de él están los servidores, y cada servidor tiene sus servidores hijo. Al crear a alguien puedes darle su cuenta para que suba sus informes."
              : "Tu célula y los servidores hijo a tu cargo. Añade un servidor hijo desde tu tarjeta y, si quieres, dale su cuenta para que suba sus informes."
          }
          aside={<Hierarchy />}
        />
        {ownCell && <div className="mt-6 max-w-4xl"><OwnCellPanel own={ownCell} /></div>}
        {networks.length > 1 && (
          <div className="mt-7 flex flex-wrap items-center gap-2">
            {networks.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setNetworkId(item.id)}
                className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${item.id === network?.id ? "bg-ink text-white" : "bg-white text-muted hover:text-ink"}`}
              >
                Red {item.code}
                <span className={`rounded-full px-1.5 text-[10.5px] ${item.id === network?.id ? "bg-white/15" : "bg-paper"}`}>{item.totals.servers}</span>
              </button>
            ))}
          </div>
        )}
        {network ? (
          <NetworkView key={network.id} network={network} canAssignLeaders={canAssignLeaders} />
        ) : (
          <p className="mt-8 rounded-2xl border border-dashed border-line px-5 py-10 text-center text-sm text-muted">Todavía no tienes servidores a tu cargo.</p>
        )}
      </div>
    </AdminLayout>
  );
}

function NetworkView({ network, canAssignLeaders }: { network: ServerNetwork; canAssignLeaders: boolean }) {
  return (
    <div className={`mt-6 grid gap-6 ${network.can_open ? "xl:grid-cols-[minmax(0,1.35fr)_minmax(0,0.65fr)]" : "max-w-4xl"}`}>
      <div className="space-y-6">
        <NetworkLeaders network={network} canAssign={canAssignLeaders} />
        <Panel
          title={`Servidores de la Red ${network.code}`}
          text={`${network.totals.servers} ${network.totals.servers === 1 ? "servidor" : "servidores"} · ${network.totals.children} ${network.totals.children === 1 ? "servidor hijo" : "servidores hijo"}`}
        >
          <div className="space-y-4">
            {network.servers.map((server) => <ServerCard key={server.id} server={server} />)}
            {!network.servers.length && (
              <p className="rounded-2xl border border-dashed border-line px-5 py-10 text-center text-sm text-muted">
                {network.can_open ? "Esta red todavía no tiene servidores. Crea el primero con el formulario." : "Esta red todavía no tiene servidores."}
              </p>
            )}
          </div>
        </Panel>
      </div>
      {network.can_open && (
        <div className="xl:sticky xl:top-6 xl:self-start">
          <ServerForm
            level="servidor"
            title={`Nuevo servidor · Red ${network.code}`}
            text={`Se crea la célula ${network.next_code}. Sus servidores hijo se añaden desde su tarjeta.`}
            url="/admin/servidores"
            hidden={{ network_id: network.id }}
            submitLabel="Crear servidor"
          />
        </div>
      )}
    </div>
  );
}

function Hierarchy() {
  const steps = [
    { level: "red" as const, example: "Red A" },
    { level: "servidor" as const, example: "01A" },
    { level: "hijo" as const, example: "0101A" },
  ];
  return (
    <ol className="flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-white px-4 py-3">
      {steps.map((step, index) => (
        <li key={step.level} className="flex items-center gap-2">
          {index > 0 && <span className="text-muted">→</span>}
          <LevelBadge level={step.level} />
          <span className="text-[11px] text-muted">{step.example}</span>
        </li>
      ))}
    </ol>
  );
}
