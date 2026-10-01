import { Link } from "@inertiajs/react";
import { useEffect, useState } from "react";
import { Rise } from "@/Components/motion/rise";
import { LeadTitle } from "@/Components/site/lead-title";
import { MediaView } from "@/Components/site/media-view";
import { readCopy } from "@/lib/copy";
import type { ResolvedMedia } from "@/lib/media";
import type { Ministry, SiteSettings } from "@/lib/types";

function MinistryPhoto({
  ministry,
  media,
  compact = false,
  className = "",
}: {
  ministry: Ministry;
  media: ResolvedMedia;
  compact?: boolean;
  className?: string;
}) {
  return (
    <Link href={`/ministerios/${ministry.slug}`} className={`ministry-photo group ${className}`.trim()}>
      <MediaView asset={media.ministry(ministry.slug, ministry.name)} fit="cover" />
      <span className="ministry-shade" />
      <span className={`ministry-copy ${compact ? "ministry-copy-compact" : ""}`}>
        <span className="ministry-age">{ministry.age_range}</span>
        <span className="ministry-name">{ministry.name}</span>
        {!compact && ministry.summary ? <span className="ministry-summary">{ministry.summary}</span> : null}
      </span>
    </Link>
  );
}

function MinistryDeck({
  ministries,
  media,
  active,
  compact = false,
}: {
  ministries: Ministry[];
  media: ResolvedMedia;
  active: number;
  compact?: boolean;
}) {
  return (
    <>
      {ministries.map((ministry, index) => (
        <div
          key={ministry.slug}
          className={`ministry-slide ${index === active ? "is-on" : ""}`}
          aria-hidden={index !== active}
        >
          <MinistryPhoto
            ministry={ministry}
            media={media}
            compact={compact}
            className={`h-full w-full ${compact ? "rounded-[1.35rem]" : "rounded-[1.55rem]"}`}
          />
        </div>
      ))}
    </>
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
  const total = ministries.length;
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (total < 2) return;
    const id = window.setInterval(() => {
      setActive((current) => (current + 1) % total);
    }, 3500);
    return () => window.clearInterval(id);
  }, [total]);

  if (!ministries[0]) return null;
  const peek = total > 1 ? (active + 1) % total : -1;

  return (
    <section className={`ministry-feature ${showCopy ? "" : "ministry-feature-photos"}`.trim()}>
      {showCopy ? (
        <Rise className="ministry-copy-col">
          <p className="kicker">{readCopy(settings, "home.ministriesKicker")}</p>
          <LeadTitle
            as="h2"
            text={settings.homeMinistriesTitle || settings.ministriesTitle}
            className="mt-4 max-w-xl text-5xl md:text-6xl"
          />
          <p className="mt-5 max-w-md text-base font-light leading-7 text-muted">{settings.ministriesText}</p>
          <Link href="/ministerios" className="ministry-more">
            {readCopy(settings, "home.ministriesMore")}
          </Link>
        </Rise>
      ) : (
        <div className="hidden lg:block" />
      )}

      <div className="ministry-stage">
        <div className="ministry-stage-main">
          <MinistryDeck ministries={ministries} media={media} active={active} />
        </div>
        {peek >= 0 ? (
          <div className="ministry-stage-peek">
            <MinistryDeck ministries={ministries} media={media} active={peek} compact />
          </div>
        ) : null}
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
  if (!ministries.length) return null;
  return (
    <div className="ministry-cards">
      {ministries.map((ministry, index) => (
        <Rise key={ministry.slug} delay={index * 160}>
          <MinistryPhoto
            ministry={ministry}
            media={media}
            className="aspect-[3/4] w-full rounded-[1.6rem]"
          />
        </Rise>
      ))}
    </div>
  );
}
