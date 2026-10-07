import { Link, usePage } from "@inertiajs/react";
import { useEffect, useState } from "react";
import { SocialIcon } from "@/Components/site/social-icons";
import { useCopy } from "@/lib/copy";
import { LIVE_HREF, useOnAir } from "@/lib/live";
import { formatCountdown, nextService } from "@/lib/next-service";
import { useSocial } from "@/lib/social";
import type { SiteSettings } from "@/lib/types";

export function ServiceCountdown({
  sunday,
  wednesday,
}: {
  sunday: string;
  wednesday: string;
}) {
  const [now, setNow] = useState(() => Date.now());
  const { settings } = usePage().props as unknown as { settings?: SiteSettings };
  const social = useSocial();
  const onAir = useOnAir();
  const t = useCopy();

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const next = nextService(sunday, wednesday, new Date(now), { main: settings?.serviceDayMain, week: settings?.serviceDayWeek });
  const live = next.live || onAir;

  return (
    <div className="service-chip">
      <Link
        href={live ? LIVE_HREF : "/visita"}
        className="service-chip-link"
        aria-label={live ? t("home.countdownLive") : `${t("home.countdownNext")}: ${next.label}`}
      />
      <div className="service-chip-body">
        <p className="service-chip-time">{live ? t("nav.live") : formatCountdown(next.at - now)}</p>
        <p className="service-chip-label">{live ? t("home.countdownLive") : t("home.countdownNext")}</p>
        {social.links.length > 0 && (
          <div className="service-chip-social">
            {social.links.map((item) => (
              <a key={item.id} href={item.href} target="_blank" rel="noreferrer" aria-label={item.label} title={item.label}>
                <SocialIcon id={item.id} />
              </a>
            ))}
          </div>
        )}
      </div>
      <svg className="service-chip-go" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.5 17.5 17.5 6.5M8.5 6.5h9v9" />
      </svg>
    </div>
  );
}
