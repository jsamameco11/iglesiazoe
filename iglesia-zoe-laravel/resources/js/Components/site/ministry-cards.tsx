import { Link } from "@inertiajs/react";
import { Rise } from "@/Components/motion/rise";
import { MediaView } from "@/Components/site/media-view";
import type { ResolvedMedia } from "@/lib/media";
import type { Ministry } from "@/lib/types";

export function MinistryCards({ ministries, media, className = "" }: { ministries: Ministry[]; media: ResolvedMedia; className?: string }) {
  if (!ministries.length) return null;
  return (
    <div className={`ministry-cards ${className}`.trim()}>
      {ministries.map((ministry, index) => (
        <Rise key={ministry.slug} delay={index * 120}>
          <Link href={`/ministerios/${ministry.slug}`} className="ministry-photo group aspect-[3/4] w-full rounded-[1.6rem]">
            <MediaView asset={media.ministry(ministry.slug, ministry.name)} fit="cover" />
            <span className="ministry-shade" />
            <span className="ministry-copy">
              <span className="ministry-age">{ministry.age_range}</span>
              <span className="ministry-name">{ministry.name}</span>
              {ministry.summary ? <span className="ministry-summary">{ministry.summary}</span> : null}
            </span>
          </Link>
        </Rise>
      ))}
    </div>
  );
}
