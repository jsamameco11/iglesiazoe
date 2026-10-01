import { PageHeader } from "@/Components/admin/ui";
import { ThemeBrowser } from "@/Components/portal/theme-browser";
import PortalLayout from "@/Layouts/PortalLayout";
import type { Theme } from "@/lib/types";

export default function Temas({ themes }: { themes: Theme[] }) {
  return (
    <PortalLayout>
      <div className="space-y-6">
        <PageHeader kicker="Células" title="Temas de célula" text="Material publicado para cada reunión. Ábrelo en línea o descárgalo para compartirlo." />
        <ThemeBrowser themes={themes} />
      </div>
    </PortalLayout>
  );
}
