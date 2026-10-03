export type ServerLevel = "red" | "servidor" | "hijo";

export type ServerAccount = { username: string; name: string; active: boolean };

export type NetworkLeader = { id: string; name: string; username: string; active: boolean };

export type ServerNode = {
  id: string;
  code: string;
  level: Exclude<ServerLevel, "red">;
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
  totals: { children: number };
};

export type ServerNetwork = {
  id: string;
  code: string;
  name: string;
  leaders: NetworkLeader[];
  can_open: boolean;
  next_code: string | null;
  servers: ServerNode[];
  totals: { servers: number; children: number };
};

export type OwnCell = {
  network_code: string;
  can_open: boolean;
  next_code: string | null;
  cell: { code: string; leader_name: string | null; meeting_day: string | null; meeting_time: string | null } | null;
};

export const levels: Record<ServerLevel, { label: string; tone: string; account: string }> = {
  red: {
    label: "Servidor de Red",
    tone: "bg-sky text-[#28516b]",
    account: "Ve toda la red: abre servidores, revisa sus informes y las ofrendas por semana.",
  },
  servidor: {
    label: "Servidor",
    tone: "bg-mist text-[#3d6248]",
    account: "Podrá subir sus informes, ver el reporte semanal y añadir sus propios servidores hijo.",
  },
  hijo: {
    label: "Servidor hijo",
    tone: "bg-blush text-[#8a4a33]",
    account: "Podrá subir sus informes y ver el reporte semanal.",
  },
};
