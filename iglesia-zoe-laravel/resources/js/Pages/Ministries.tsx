import { Rise } from "@/Components/motion/rise";
import { MinistryCards } from "@/Components/site/ministry-cards";
import { PageIntro } from "@/Components/site/page-intro";
import SiteLayout from "@/Layouts/SiteLayout";
import { resolveMedia, type MediaAsset } from "@/lib/media";
import type { Ministry, SiteSettings } from "@/lib/types";
import { section } from "@/lib/design";
import { useSitePages } from "@/lib/site-pages";

export default function Ministries({
  ministries,
  mediaOverrides,
  settings,
  skin,
}: {
  ministries: Ministry[];
  mediaOverrides: Record<string, MediaAsset>;
  settings: SiteSettings;
  skin: "aire" | "marea";
}) {
  const pages = useSitePages();
  const media = resolveMedia(mediaOverrides);
  return (
    <SiteLayout>
      <article className="page-wrap">
        <Rise>
          <PageIntro skin={skin} kicker={pages.kicker("ministries")} title={settings.ministriesTitle}>
            <p className="mt-6 max-w-xl text-lg font-light leading-8 text-muted">{settings.ministriesText}</p>
          </PageIntro>
        </Rise>
        <div {...section("cards", "Ministerios")} className="mt-14">
          <MinistryCards ministries={ministries} media={media} />
        </div>
      </article>
    </SiteLayout>
  );
}
