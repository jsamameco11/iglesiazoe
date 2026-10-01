import type { SupabaseClient } from "@supabase/supabase-js";
import type { Role } from "./types";

export type AdminCapabilities = {
  manageMembers: boolean;
  viewOfferings: boolean;
  viewCellActivity: boolean;
  manageMedia: boolean;
  manageContent: boolean;
  manageCells: boolean;
  manageUsers: boolean;
  manageGenerosity: boolean;
};

export const defaultCapabilities: AdminCapabilities = {
  manageMembers: false,
  viewOfferings: false,
  viewCellActivity: true,
  manageMedia: true,
  manageContent: true,
  manageCells: true,
  manageUsers: true,
  manageGenerosity: true,
};

export const capabilityCatalog: {
  key: keyof AdminCapabilities;
  title: string;
  text: string;
}[] = [
  {
    key: "manageMembers",
    title: "Integrantes de célula",
    text: "Permite agregar o quitar participantes dentro de cada célula.",
  },
  {
    key: "viewCellActivity",
    title: "Actividad de células",
    text: "Permite ver si la célula se reunió, la asistencia, el tema y las fotos.",
  },
  {
    key: "viewOfferings",
    title: "Montos de ofrenda y diezmo",
    text: "Permite ver totales de dinero. Permanece apagado para el administrador.",
  },
  {
    key: "manageMedia",
    title: "Fotos, imágenes y videos",
    text: "Permite cambiar el material visual del sitio y descargar evidencias.",
  },
  {
    key: "manageContent",
    title: "Contenido público",
    text: "Permite editar inicio, ministerios, prédicas y bautismos.",
  },
  {
    key: "manageCells",
    title: "Células y redes",
    text: "Permite administrar redes, células y células hijas.",
  },
  {
    key: "manageUsers",
    title: "Usuarios líderes",
    text: "Permite crear líderes de célula y de red. No puede crear superadministradores.",
  },
  {
    key: "manageGenerosity",
    title: "Datos públicos de generosidad",
    text: "Permite editar cuentas y medios de pago visibles en la web, sin ver reportes de dinero.",
  },
];

export function isStaff(role?: Role | null) {
  return role === "admin" || role === "superadmin";
}

export function isSuperadmin(role?: Role | null) {
  return role === "superadmin";
}

export function roleLabel(role?: Role | null) {
  if (role === "superadmin") return "Superadministrador";
  if (role === "admin") return "Administrador";
  if (role === "red_leader") return "Líder de red";
  return "Líder de célula";
}

export async function getCapabilities(
  supabase: SupabaseClient,
  role?: Role | null,
): Promise<AdminCapabilities> {
  if (isSuperadmin(role)) {
    return Object.fromEntries(Object.keys(defaultCapabilities).map((key) => [key, true])) as AdminCapabilities;
  }
  const { data } = await supabase
    .from("site_settings")
    .select("value")
    .eq("key", "admin_capabilities")
    .maybeSingle();
  return { ...defaultCapabilities, ...((data?.value || {}) as Partial<AdminCapabilities>) };
}
