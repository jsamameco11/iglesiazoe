import { Link } from "@inertiajs/react";
import { Rise } from "@/Components/motion/rise";
import { useCopy } from "@/lib/copy";
import { useSitePages, type PageKey } from "@/lib/site-pages";
import { useSocial } from "@/lib/social";
import type { SiteSettings } from "@/lib/types";

const KNOW: PageKey[] = ["about", "ministries", "events", "sermons", "gallery", "devotionals", "teachings", "radio"];
const NEXT: PageKey[] = ["visit", "baptism", "serve", "register", "route", "give", "classroom"];

export function Footer({
  settings,
  other,
}: {
  settings: SiteSettings;
  other?: { href: string; label: string; invert?: boolean };
}) {
  const t = useCopy();
  const pages = useSitePages();
  const social = useSocial();
  return (
    <footer className="border-t border-line px-6 py-20 md:px-16 lg:px-24">
      <Rise>
      <div className="grid gap-12 md:grid-cols-12">
        <div className="md:col-span-4">
          <p className="text-lg font-medium tracking-tight text-ink">{t("footer.brand")}</p>
          <p className="mt-4 max-w-xs text-sm font-light leading-6 text-muted">
            {settings.footerTagline}
          </p>
        </div>
        <div className="text-sm leading-7 md:col-span-2">
          <p className="kicker">{t("footer.colKnow")}</p>
          {KNOW.map((key, index) => (
            <Link key={key} href={pages.path(key)} className={index === 0 ? "mt-3 block" : "block text-muted"}>{pages.name(key)}</Link>
          ))}
        </div>
        <div className="text-sm leading-7 md:col-span-3">
          <p className="kicker">{t("footer.colNext")}</p>
          {NEXT.map((key, index) => (
            <Link key={key} href={pages.path(key)} className={index === 0 ? "mt-3 block" : "block text-muted"}>{pages.name(key)}</Link>
          ))}
          <Link href="/acceso" className="block text-muted">{t("nav.access")}</Link>
        </div>
        <div className="text-sm leading-7 md:col-span-3">
          <p className="kicker">{t("footer.colVisit")}</p>
          <p className="mt-3">{settings.address}</p>
          <p className="text-muted">{settings.sunday}</p>
          <p className="text-muted">{settings.wednesday}</p>
          {social.messenger && (
            <a href={social.messenger} className="mt-3 block" target="_blank" rel="noreferrer">
              {t("footer.messenger")}
            </a>
          )}
          {social.whatsapp && (
            <a href={social.whatsapp} className="block" target="_blank" rel="noreferrer">
              {t("footer.whatsapp")}
            </a>
          )}
          {settings.email && (
            <a href={`mailto:${settings.email.trim().toLowerCase()}`} className="block text-muted [overflow-wrap:anywhere]">
              {settings.email.trim().toLowerCase()}
            </a>
          )}
          {social.links.map((item) => (
            <a key={item.id} href={item.href} className="block text-muted" target="_blank" rel="noreferrer">
              {item.label}
            </a>
          ))}
          {other && (
            <a href={other.href} className="mt-5 block text-sm text-muted underline-offset-4 hover:underline">
              {other.label}
            </a>
          )}
        </div>
      </div>
      </Rise>
    </footer>
  );
}
