import { SettingsForm } from "@/Components/admin/settings-form";
import AdminLayout from "@/Layouts/AdminLayout";
import type { SiteSettings } from "@/lib/types";

export default function Generosidad({ settings }: { settings: SiteSettings }) {
  return (
    <AdminLayout>
      <h1 className="display text-4xl">Generosidad</h1>
      <p className="mt-2 mb-6 text-muted">Cuentas, Yape y el enlace de la pasarela de tarjeta.</p>
      <SettingsForm settings={settings} section="generosidad" />
    </AdminLayout>
  );
}
