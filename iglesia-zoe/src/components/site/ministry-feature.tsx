import Link from "next/link";
import { Rise } from "@/components/motion/rise";
import { LeadTitle } from "@/components/site/lead-title";
import { MediaView } from "@/components/site/media-view";
import type { ResolvedMedia } from "@/lib/media";
import type { Ministry, SiteSettings } from "@/lib/types";

function MinistryPhoto({
  ministry,
  media,
  className = "",
}: {
  ministry: Ministry;
  media: ResolvedMedia;
  className?: string;
}) {
  return (
    <Link href={`/ministerios/${ministry.slug}`} className={`group relative block overflow-hidden bg-[#efe8df] ${className}`.trim()}>
      <MediaView asset={media.ministry(ministry.slug, ministry.name)} fit="cover" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 p-5 text-white md:p-6">
        <p className="text-[10px] uppercase tracking-[0.22em] text-white/75">{ministry.age_range}</p>
        <p className="editorial mt-1 text-3xl leading-none md:text-4xl">{ministry.name}</p>
        <p className="mt-2 max-w-xs text-sm leading-5 text-white/80">{ministry.summary}</p>
      </div>
    </Link>
  );
}

export function MinistryFeature({
  settings,
  ministries,
  media,
  showCopy = true,
}: {
  settings: SiteSettings;
  ministries: Ministry[];
  media: ResolvedMedia;
  showCopy?: boolean;
}) {
  const featured = ministries[0];
  const peek = ministries[1];
  if (!featured) return null;

  return (
    <section className={`grid items-center gap-10 px-4 py-6 md:px-8 lg:gap-6 lg:px-12 ${showCopy ? "lg:grid-cols-[0.9fr_1.1fr]" : ""}`}>
      {showCopy ? (
        <Rise>
          <p className="kicker">Ministerios</p>
          <LeadTitle as="h2" text={settings.homeMinistriesTitle || settings.ministriesTitle} className="mt-4 max-w-xl text-5xl md:text-6xl" />
          <p className="mt-5 max-w-md text-base font-light leading-7 text-muted">{settings.ministriesText}</p>
          <Link
            href="/ministerios"
            className="mt-8 inline-flex rounded-full bg-ink px-7 py-3.5 text-sm font-medium text-white"
          >
            Conoce más
          </Link>
        </Rise>
      ) : (
        <div className="hidden lg:block" />
      )}

      <div className="relative flex min-h-[340px] items-center sm:min-h-[420px] lg:min-h-[520px]">
        <Rise className="relative z-10 w-[72%] sm:w-[70%]">
          <MinistryPhoto
            ministry={featured}
            media={media}
            className="aspect-[4/5] w-full rounded-[1.75rem] shadow-[0_28px_60px_-28px_rgba(28,24,20,0.55)]"
          />
        </Rise>
        {peek && (
          <Rise delay={220} className="absolute right-0 top-[12%] z-0 w-[34%] sm:w-[32%]">
            <MinistryPhoto
              ministry={peek}
              media={media}
              className="aspect-[3/4] w-full rounded-[1.5rem] shadow-[0_22px_44px_-24px_rgba(28,24,20,0.45)]"
            />
          </Rise>
        )}
      </div>
    </section>
  );
}

export function MinistryCards({
  ministries,
  media,
}: {
  ministries: Ministry[];
  media: ResolvedMedia;
}) {
  return (
    <div className="grid gap-4 px-4 sm:grid-cols-2 md:px-8 lg:grid-cols-4 lg:px-12">
      {ministries.map((ministry, index) => (
        <Rise key={ministry.slug} delay={index * 160}>
          <MinistryPhoto
            ministry={ministry}
            media={media}
            className="aspect-[3/4] w-full rounded-[1.6rem] shadow-[0_22px_44px_-24px_rgba(28,24,20,0.4)]"
          />
        </Rise>
      ))}
    </div>
  );
}
