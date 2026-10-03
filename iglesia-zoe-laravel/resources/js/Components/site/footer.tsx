import { Link } from "@inertiajs/react";
import { Rise } from "@/Components/motion/rise";
import { SocialIcon } from "@/Components/site/social-icons";
import { useCopy } from "@/lib/copy";
import { footerAlign, hex, readableInk, useFooterDesign, type FooterPart, type FooterRule, type Palette } from "@/lib/design";
import { useSitePages, type PageKey } from "@/lib/site-pages";
import { useSocial } from "@/lib/social";
import type { SiteSettings } from "@/lib/types";
import "../../../css/footer.css";

const KNOW: PageKey[] = ["about", "ministries", "events", "sermons", "gallery", "devotionals", "teachings", "radio"];
const NEXT: PageKey[] = ["visit", "baptism", "serve", "register", "route", "give", "classroom"];
const PARTS: FooterPart[] = ["brand", "slogan", "titles", "links"];

/** Colors and size factors of the footer as CSS variables; texts without a color follow the background's contrast. */
function footerStyle(rule: FooterRule, palette: Palette) {
  const background = hex(rule.background, palette.ink);
  const ink = readableInk(background, palette.ink);
  const style: Record<string, string> = {
    "--footer-bg": background,
    "--footer-fg": ink,
    "--footer-accent": palette.accent,
    "--footer-link": `color-mix(in srgb, ${ink} 70%, transparent)`,
  };
  PARTS.forEach((part) => {
    const text = rule[part];
    const color = hex(text?.color, "");
    if (color) style[`--footer-${part}-color`] = color;
    if (text?.size && text.size !== 1) style[`--footer-${part}-scale`] = String(text.size);
  });
  return style as React.CSSProperties;
}

/** The closing band shared by every page: name, slogan, social icons, link columns and the closing strip. */
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
  const { rule, palette } = useFooterDesign();
  const brand = t("footer.brand");
  const place = rule.logo ? rule.logoPlace : undefined;
  const align = (part: FooterPart) => footerAlign(rule, part);
  const email = settings.email?.trim().toLowerCase();
  const icons = [
    ...social.links.map((item) => ({ key: item.id, href: item.href, label: item.label, icon: <SocialIcon id={item.id} /> })),
    ...(social.whatsapp ? [{ key: "whatsapp", href: social.whatsapp, label: "WhatsApp", icon: <WhatsAppIcon /> }] : []),
  ];
  const logo = (where: string) => (
    <img src={rule.logo} alt={place === "only" || place === "center" ? brand : ""} className="site-footer-logo" data-place={where} style={{ height: rule.logoSize ?? 56 }} />
  );

  return (
    <footer data-site-footer className="site-footer" data-logo={place} style={footerStyle(rule, palette)}>
      <div className="site-footer-inner">
        <Rise className="site-footer-head">
          {place === "center" && <div className="site-footer-crest">{logo("center")}</div>}
          <Link href="/" className="site-footer-brand" data-align={align("brand")} data-stack={place === "above" || undefined} aria-label={brand}>
            {(place === "above" || place === "beside" || place === "only") && logo(place)}
            {place !== "only" && <span className="site-footer-name">{brand}</span>}
          </Link>
          {settings.footerTagline && (
            <div className="site-footer-slogan" data-align={align("slogan")} data-reveal-item>
              {settings.footerTagline}
            </div>
          )}
          {icons.length > 0 && (
            <div className="site-footer-social" data-align={align("slogan")} data-reveal-item>
              {icons.map((item) => (
                <a key={item.key} href={item.href} target="_blank" rel="noreferrer" aria-label={item.label} title={item.label}>
                  {item.icon}
                </a>
              ))}
            </div>
          )}
        </Rise>

        <Rise className="site-footer-columns" delay={90}>
          <nav aria-label={t("footer.colKnow")} className="site-footer-column" data-reveal-item>
            <div className="site-footer-title" data-align={align("titles")}>{t("footer.colKnow")}</div>
            <div className="site-footer-links" data-align={align("links")}>
              {KNOW.map((key) => (
                <Link key={key} href={pages.path(key)}>{pages.name(key)}</Link>
              ))}
            </div>
          </nav>
          <nav aria-label={t("footer.colNext")} className="site-footer-column" data-reveal-item>
            <div className="site-footer-title" data-align={align("titles")}>{t("footer.colNext")}</div>
            <div className="site-footer-links" data-align={align("links")}>
              {NEXT.map((key) => (
                <Link key={key} href={pages.path(key)}>{pages.name(key)}</Link>
              ))}
            </div>
          </nav>
          <div className="site-footer-column" data-reveal-item>
            <div className="site-footer-title" data-align={align("titles")}>{t("footer.colVisit")}</div>
            <div className="site-footer-links" data-align={align("links")}>
              {settings.address && <span className="site-footer-strong">{settings.address}</span>}
              {settings.sunday && <span>{settings.sunday}</span>}
              {settings.wednesday && <span>{settings.wednesday}</span>}
              {social.whatsapp && <a href={social.whatsapp} target="_blank" rel="noreferrer" className="site-footer-gap">{t("footer.whatsapp")}</a>}
              {social.messenger && <a href={social.messenger} target="_blank" rel="noreferrer" className={social.whatsapp ? undefined : "site-footer-gap"}>{t("footer.messenger")}</a>}
              {email && <a href={`mailto:${email}`} className="site-footer-email">{email}</a>}
            </div>
          </div>
        </Rise>

        <Rise className="site-footer-bottom" delay={160}>
          <div className="site-footer-legal">
            {place === "bottom" && logo("bottom")}
            <span>
              © {new Date().getFullYear()} <span className="site-footer-legal-name">{brand}</span> · {t("footer.rights")}
            </span>
          </div>
          <div className="site-footer-legal-links">
            <Link href="/acceso">{t("nav.access")}</Link>
            {other && <a href={other.href}>{other.label}</a>}
          </div>
        </Rise>
      </div>
    </footer>
  );
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12.04 2.2a9.77 9.77 0 0 0-8.4 14.78L2.2 21.8l4.95-1.4A9.78 9.78 0 1 0 12.04 2.2Zm0 17.86a8.1 8.1 0 0 1-4.13-1.13l-.3-.18-2.94.83.86-2.86-.19-.3a8.1 8.1 0 1 1 6.7 3.64Zm4.44-6.06c-.24-.12-1.43-.7-1.65-.79-.22-.08-.38-.12-.54.12-.16.24-.62.79-.76.95-.14.16-.28.18-.52.06a6.63 6.63 0 0 1-3.27-2.86c-.25-.42.25-.4.7-1.32.08-.16.04-.3-.02-.42-.06-.12-.54-1.3-.74-1.78-.2-.47-.4-.4-.54-.4h-.46a.88.88 0 0 0-.64.3 2.68 2.68 0 0 0-.84 2c0 1.18.86 2.32.98 2.48.12.16 1.7 2.6 4.12 3.64 1.53.66 2.13.72 2.9.6.47-.07 1.43-.58 1.63-1.15.2-.56.2-1.05.14-1.15-.06-.1-.22-.16-.46-.28Z" />
    </svg>
  );
}
