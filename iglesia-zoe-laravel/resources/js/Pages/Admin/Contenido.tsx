import { SettingsForm } from "@/Components/admin/settings-form";
import AdminLayout from "@/Layouts/AdminLayout";
import type { SiteSettings } from "@/lib/types";

export default function Contenido({ settings }: { settings: SiteSettings }) {
  return (
    <AdminLayout>
      <h1 className="display text-4xl">Contenido del sitio</h1>
      <p className="mt-2 mb-6 max-w-2xl leading-7 text-muted">
        Todos los textos variables de la web. Las fechas de bautismo se publican en Bautismos. Las fotos, en Medios.
      </p>
      <SettingsForm settings={settings} section="contenido" />
    </AdminLayout>
  );
}
