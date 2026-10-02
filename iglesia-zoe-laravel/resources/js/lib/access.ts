import { usePage } from "@inertiajs/react";

export type Permission =
  | "reports.submit"
  | "reports.weekly"
  | "reports.all"
  | "offerings.weekly"
  | "servers.create"
  | "cells.manage"
  | "themes.manage"
  | "design.manage"
  | "media.manage"
  | "content.manage"
  | "generosity.manage"
  | "notices.manage"
  | "events.manage"
  | "devotionals.manage"
  | "studies.grades"
  | "studies.board"
  | "expenses.manage"
  | "inbox.visits"
  | "inbox.baptisms"
  | "inbox.prayers"
  | "inbox.serve";

export type AdminType = "red" | "visuales" | "celula" | "atmosfera" | "voluntarios" | "temas" | "estudios";

export type PanelUser = {
  id: string;
  username: string;
  full_name: string | null;
  cereal: string;
  superadmin: boolean;
  types: AdminType[];
  permissions: Permission[];
  network_id: string | null;
};

export type Catalog = {
  permissions: { key: Permission; group: string; title: string; text: string }[];
  types: { key: AdminType; label: string; text: string; permissions: Permission[]; exclusive?: boolean; server: boolean }[];
  defaults: Permission[];
};

export function usePanelUser() {
  const { auth } = usePage<{ auth: { user: PanelUser } }>().props as unknown as { auth: { user: PanelUser } };
  return auth.user;
}

export function can(user: PanelUser | null | undefined, ...permissions: (Permission | "superadmin")[]) {
  if (!user) return false;
  if (user.superadmin) return true;
  return permissions.some((permission) => permission !== "superadmin" && user.permissions.includes(permission));
}

export function money(value: number | null | undefined) {
  return `S/ ${Number(value || 0).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
