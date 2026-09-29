import { SettingsForm } from "@/components/admin/settings-form";
import { getSettings } from "@/lib/content";

export default async function ContentAdminPage() {
  const settings = await getSettings();
  return (
    <div>
      <h1 className="display text-4xl">Contenido del sitio</h1>
      <p className="mt-2 mb-6 text-muted">Textos, horarios, pastores y redes del sitio público.</p>
      <SettingsForm settings={settings} section="contenido" />
    </div>
  );
}
