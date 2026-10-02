import { Link } from "@inertiajs/react";
import type { CopyKey } from "@/lib/copy";
import type { Devotional } from "@/lib/types";
import { formatSermonDate } from "@/lib/youtube";

export function DevotionalCard({ item, t }: { item: Devotional; t: (key: CopyKey) => string }) {
  return (
    <Link href={`/devocionales/${item.slug}`} className="devo-card lift">
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
