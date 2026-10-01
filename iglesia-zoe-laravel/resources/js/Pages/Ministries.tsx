import { Rise } from "@/Components/motion/rise";
import { MinistryCards, MinistryFeature } from "@/Components/site/ministry-feature";
import { PageIntro } from "@/Components/site/page-intro";
import SiteLayout from "@/Layouts/SiteLayout";
import { readCopy } from "@/lib/copy";
import { resolveMedia, type MediaAsset } from "@/lib/media";
import type { Ministry, SiteSettings } from "@/lib/types";

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
  const media = resolveMedia(mediaOverrides);
  return (
    <SiteLayout>
      <article className="pb-16">
        <div className="page-wrap pb-0">
          <Rise>
            <PageIntro skin={skin} kicker={readCopy(settings, "ministries.kicker")} title={settings.ministriesTitle}>
              <p className="mt-6 max-w-xl text-lg font-light leading-8 text-muted">{settings.ministriesText}</p>
            </PageIntro>
          </Rise>
        </div>
        <MinistryFeature settings={settings} ministries={ministries} media={media} showCopy={false} />
        <MinistryCards ministries={ministries} media={media} />
      </article>
    </SiteLayout>
  );
}
