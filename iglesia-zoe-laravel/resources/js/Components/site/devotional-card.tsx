import { Link } from "@inertiajs/react";
import type { CopyKey } from "@/lib/copy";
import type { Devotional } from "@/lib/types";
import { formatSermonDate } from "@/lib/youtube";

export function DevotionalCard({ item, cover, t }: { item: Devotional; cover: string; t: (key: CopyKey) => string }) {
  const photo = item.image || cover;
  return (
    <Link href={`/devocionales/${item.slug}`} className="devo-card lift">
      {photo ? (
        <span className="devo-card-photo">
          <img src={photo} alt="" loading="lazy" />
        </span>
      ) : null}
      <span className="devo-card-meta">
        {formatSermonDate(item.publish_on)} · {item.minutes} {t("devotionals.minutes")}
      </span>
      <span className="devo-card-title">{item.title}</span>
      {item.verse_ref ? <span className="devo-card-ref">{item.verse_ref}</span> : null}
      <span className="devo-card-excerpt">{item.excerpt}</span>
      <span className="devo-card-open">{t("devotionals.read")} →</span>
    </Link>
  );
}
