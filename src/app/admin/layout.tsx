import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/shell";
import { getSession } from "@/lib/session";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await getSession();
  if (!profile) redirect("/ingresar?next=/admin");
  if (profile.role !== "admin") redirect("/portal/informe");
  return <AdminShell>{children}</AdminShell>;
}
