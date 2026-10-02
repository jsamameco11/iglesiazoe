import { Link } from "@inertiajs/react";
import { Rise } from "@/Components/motion/rise";
import { useCopy } from "@/lib/copy";
import { useSocial } from "@/lib/social";
import type { SiteSettings } from "@/lib/types";

export function Footer({
  settings,
  other,
}: {
  settings: SiteSettings;
  other?: { href: string; label: string; invert?: boolean };
}) {
  const t = useCopy();
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
          <Link href="/conocenos" className="mt-3 block">{t("nav.about")}</Link>
          <Link href="/ministerios" className="block text-muted">{t("nav.ministries")}</Link>
          <Link href="/eventos" className="block text-muted">{t("nav.events")}</Link>
          <Link href="/predicas" className="block text-muted">{t("nav.sermons")}</Link>
          <Link href="/galeria" className="block text-muted">{t("nav.gallery")}</Link>
          <Link href="/devocionales" className="block text-muted">{t("nav.devotionals")}</Link>
          <Link href="/recursos" className="block text-muted">{t("nav.teachings")}</Link>
          <Link href="/radio" className="block text-muted">{t("nav.radio")}</Link>
        </div>
        <div className="text-sm leading-7 md:col-span-3">
          <p className="kicker">{t("footer.colNext")}</p>
          <Link href="/visita" className="mt-3 block">{settings.visitCta}</Link>
          <Link href="/bautismos" className="block text-muted">{t("nav.baptism")}</Link>
          <Link href="/involucrate" className="block text-muted">{t("nav.areas")}</Link>
          <Link href="/involucrate#registro" className="block text-muted">{t("nav.register")}</Link>
          <Link href="/ruta-del-servidor" className="block text-muted">{t("nav.route")}</Link>
          <Link href="/dar" className="block text-muted">{t("footer.give")}</Link>
          <Link href="/estudios/acceso" className="block text-muted">{t("nav.studentAccess")}</Link>
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
