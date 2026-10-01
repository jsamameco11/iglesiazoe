import SiteLayout from "@/Layouts/SiteLayout";
import { resolveMedia, type MediaAsset } from "@/lib/media";
import type { Ministry, SiteSettings } from "@/lib/types";
import { AireHome } from "@/propuestas/aire/home";
import { MareaHome } from "@/propuestas/marea/home";

export default function Home({
  settings,
  ministries,
  mediaOverrides,
  skin,
}: {
  settings: SiteSettings;
  ministries: Ministry[];
  mediaOverrides: Record<string, MediaAsset>;
  skin: "aire" | "marea";
}) {
  const media = resolveMedia(mediaOverrides);
  return (
    <SiteLayout overMedia={skin === "marea" ? "split" : true}>
      {skin === "marea" ? (
        <MareaHome settings={settings} ministries={ministries} media={media} />
      ) : (
        <AireHome settings={settings} ministries={ministries} media={media} />
      )}
    </SiteLayout>
  );
}
