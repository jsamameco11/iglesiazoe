import { SettingsForm } from "@/components/admin/settings-form";
import { getSettings } from "@/lib/content";

export default async function GivingAdminPage() {
  const settings = await getSettings();
  return (
    <div>
      <h1 className="display text-4xl">Generosidad</h1>
      <p className="mt-2 mb-6 text-muted">Cuentas, Yape y el enlace de la pasarela de tarjeta.</p>
      <SettingsForm settings={settings} section="generosidad" />
    </div>
  );
}
