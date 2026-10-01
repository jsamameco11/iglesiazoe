import { AdminShell } from "@/Components/admin/shell";
import { usePanelUser } from "@/lib/access";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell user={usePanelUser()}>{children}</AdminShell>;
}
