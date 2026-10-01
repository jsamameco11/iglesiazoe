import { SettingsForm } from "@/components/admin/settings-form";
import { getSettings } from "@/lib/content";

export default async function ContentAdminPage() {
  const settings = await getSettings();
  return (
    <div>
      <h1 className="display text-4xl">Contenido del sitio</h1>
      <p className="mt-2 mb-6 max-w-2xl leading-7 text-muted">
        Todos los textos variables de la web: inicio, Conócenos, ministerios, bautismos, visita, oración, prédicas y generosidad. Las fechas de bautismo se publican en Bautismos. Las fotos, en Medios.
      </p>
      <SettingsForm settings={settings} section="contenido" />
    </div>
  );
}
