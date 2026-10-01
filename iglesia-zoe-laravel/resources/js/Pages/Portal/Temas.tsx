import { ThemeBrowser } from "@/Components/portal/theme-browser";
import PortalLayout from "@/Layouts/PortalLayout";
import type { Theme } from "@/lib/types";

export default function Temas({ themes }: { themes: Theme[] }) {
  return (
    <PortalLayout>
      <h1 className="display text-4xl">Temas</h1>
      <p className="mt-2 mb-6 text-muted">Material de célula publicado por el administrador.</p>
      <ThemeBrowser themes={themes} />
    </PortalLayout>
  );
}
