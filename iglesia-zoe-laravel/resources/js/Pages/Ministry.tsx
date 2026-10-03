import { Link } from "@inertiajs/react";
import { Rise } from "@/Components/motion/rise";
import { MinistryCarousel } from "@/Components/site/ministry-carousel";
import { PageIntro } from "@/Components/site/page-intro";
import SiteLayout from "@/Layouts/SiteLayout";
import { resolveMedia, type MediaAsset } from "@/lib/media";
import type { Ministry } from "@/lib/types";
import { useSitePages } from "@/lib/site-pages";

export default function Ministry({
  ministry,
  mediaOverrides,
  skin,
}: {
  ministry: Ministry;
  mediaOverrides: Record<string, MediaAsset>;
  skin: "aire" | "marea";
}) {
  const pages = useSitePages();
  const media = resolveMedia(mediaOverrides);
  return (
    <SiteLayout>
      <article className="page-wrap">
        <Rise>
          <Link href="/ministerios" className="text-sm text-muted transition hover:text-ink">{pages.name("ministries")}</Link>
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
                {pages.name("visit")}
              </Link>
            </PageIntro>
          </Rise>
        </div>
      </article>
    </SiteLayout>
  );
}
