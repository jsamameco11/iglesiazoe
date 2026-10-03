import type { CellLevel } from "@/Components/ui/cell-code";

export type ServerLevel = CellLevel;

export type ServerAccount = { username: string; name: string; active: boolean };

export type NetworkLeader = { id: string; name: string; username: string; active: boolean; me: boolean };

export type ServerNode = {
  id: string;
  code: string;
  level: ServerLevel;
  /** Level of the servers that can hang from this one; null for a subhijo and the network cell. */
  child_level: ServerLevel | null;
  leader_name: string | null;
  meeting_day: string | null;
  meeting_time: string | null;
  active: boolean;
  own: boolean;
  accounts: ServerAccount[];
  can_add_child: boolean;
  can_give_account: boolean;
  next_child_code: string | null;
  number: number;
  children: ServerNode[];
  totals: { children: number; descendants: number };
};

export type ServerNetwork = {
  id: string;
  code: string;
  name: string;
  leaders: NetworkLeader[];
  can_manage_leaders: boolean;
  can_open: boolean;
  next_code: string | null;
  servers: ServerNode[];
  totals: { servers: number; children: number; grandchildren: number };
};

export type OwnCellChoices = {
  network: string | null;
  numbered: string;
  free: { id: string; code: string; leader_name: string | null }[];
};

export type OwnCell = {
  network_code: string;
  can_open: boolean;
  choices: OwnCellChoices | null;
  cell: { code: string; leader_name: string | null; meeting_day: string | null; meeting_time: string | null } | null;
};

const cellAccount = "Podrá subir sus informes y ver el reporte semanal. No crea servidores.";

export const levels: Record<ServerLevel, { label: string; one: string; many: string; tone: string; account: string }> = {
  red: {
    label: "Servidor de Red",
    one: "Servidor de Red",
    many: "Servidores de Red",
    tone: "bg-sky text-[#28516b]",
    account: "Ve toda la red: abre servidores, revisa sus informes y las ofrendas por semana.",
  },
  servidor: { label: "Servidor Base", one: "Servidor Base", many: "Servidores Base", tone: "bg-mist text-[#3d6248]", account: cellAccount },
  hijo: { label: "Servidor hijo", one: "servidor hijo", many: "servidores hijo", tone: "bg-blush text-[#8a4a33]", account: cellAccount },
  subhijo: { label: "Servidor subhijo", one: "servidor subhijo", many: "servidores subhijo", tone: "bg-clay text-clay-deep", account: cellAccount },
};

export const countOf = (value: number, level: ServerLevel) => `${value} ${value === 1 ? levels[level].one : levels[level].many}`;
