import { Link } from "@inertiajs/react";
import { Rise } from "@/Components/motion/rise";
import { MinistryCarousel } from "@/Components/site/ministry-carousel";
import { PageIntro } from "@/Components/site/page-intro";
import SiteLayout from "@/Layouts/SiteLayout";
import { readCopy } from "@/lib/copy";
import { resolveMedia, type MediaAsset } from "@/lib/media";
import type { Ministry, SiteSettings } from "@/lib/types";

export default function Ministry({
  ministry,
  mediaOverrides,
  settings,
  skin,
}: {
  ministry: Ministry;
  mediaOverrides: Record<string, MediaAsset>;
  settings: SiteSettings;
  skin: "aire" | "marea";
}) {
  const media = resolveMedia(mediaOverrides);
  return (
    <SiteLayout>
      <article className="page-wrap">
        <Rise>
          <Link href="/ministerios" className="text-sm text-muted transition hover:text-ink">{readCopy(settings, "ministries.back")}</Link>
        </Rise>
        <div className="mt-10">
          <Rise>
            <PageIntro
              skin={skin}
              kicker={ministry.age_range}
              title={ministry.name}
              media={<MinistryCarousel assets={media.ministryGallery(ministry.slug, ministry.name)} name={ministry.name} />}
            >
              <p className="mt-8 max-w-xl text-lg font-light leading-8 text-muted">{ministry.body}</p>
              <Link href="/visita" className="mt-10 inline-block rounded-full bg-accent px-6 py-3 text-sm font-medium text-white">
                {settings.visitCta}
              </Link>
            </PageIntro>
          </Rise>
        </div>
      </article>
    </SiteLayout>
  );
}
