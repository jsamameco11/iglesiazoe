import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/shell";
import { getCapabilities, isStaff, isSuperadmin, roleLabel } from "@/lib/access";
import { getSession } from "@/lib/session";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { supabase, profile } = await getSession();
  if (!profile) redirect("/ingresar?next=/admin");
  if (!isStaff(profile.role)) redirect("/portal/informe");
  const capabilities = await getCapabilities(supabase, profile.role);
  return (
    <AdminShell
      roleLabel={roleLabel(profile.role)}
      superadmin={isSuperadmin(profile.role)}
      capabilities={capabilities}
    >
      {children}
    </AdminShell>
  );
}
