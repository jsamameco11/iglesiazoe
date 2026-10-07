import { Link } from "@inertiajs/react";
import { Rise } from "@/Components/motion/rise";
import { SocialIcon, WhatsAppIcon } from "@/Components/site/social-icons";
import { useCopy } from "@/lib/copy";
import { footerAlignChoice, hex, readableInk, useFooterDesign, type FooterPart, type FooterRule, type Palette } from "@/lib/design";
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
    "--footer-link": `color-mix(in srgb, ${ink} 80%, transparent)`,
  };
  PARTS.forEach((part) => {
    const text = rule[part];
    const color = hex(text?.color, "");
    if (color) style[`--footer-${part}-color`] = color;
    if (text?.size && text.size !== 1) style[`--footer-${part}-scale`] = String(text.size);
  });
  return style as React.CSSProperties;
}

/** "993 564 401" or "+51 993 564 401" for a WhatsApp number typed in any shape. */
function phoneLabel(value: string) {
  const digits = value.replace(/\D/g, "");
  const local = digits.length === 11 && digits.startsWith("51") ? digits.slice(2) : digits;
  if (local.length !== 9) return value.trim();
  const grouped = local.replace(/(\d{3})(\d{3})(\d{3})/, "$1 $2 $3");
  return local === digits ? grouped : `+51 ${grouped}`;
}

/** The closing band shared by every page: link columns and contact on the left, name, slogan and networks closing the right. */
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
  const align = (part: FooterPart) => footerAlignChoice(rule, part);
  const email = settings.email?.trim().toLowerCase();
  const whatsapp = settings.whatsapp ? phoneLabel(settings.whatsapp) : "";
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
        {place === "center" && <div className="site-footer-crest">{logo("center")}</div>}

        <Rise className="site-footer-grid">
          <div className="site-footer-head" data-reveal-item>
            <Link href="/" className="site-footer-brand" data-align={align("brand")} data-stack={place === "above" || undefined} aria-label={brand}>
              {(place === "above" || place === "beside" || place === "only") && logo(place)}
              {place !== "only" && <span className="site-footer-name">{brand}</span>}
            </Link>
            {settings.footerTagline && (
              <p className="site-footer-slogan" data-align={align("slogan")}>
                {settings.footerTagline}
              </p>
            )}
            {icons.length > 0 && (
              <div className="site-footer-social" data-align={align("slogan")}>
                {icons.map((item) => (
                  <a key={item.key} href={item.href} target="_blank" rel="noreferrer" aria-label={item.label} title={item.label}>
                    {item.icon}
                  </a>
                ))}
              </div>
            )}
          </div>

          <nav aria-label={t("footer.colKnow")} className="site-footer-column" data-area="know" data-reveal-item>
            <h2 className="site-footer-title" data-align={align("titles")}>{t("footer.colKnow")}</h2>
            <div className="site-footer-links" data-align={align("links")}>
              {KNOW.map((key) => (
                <Link key={key} href={pages.path(key)}>{pages.name(key)}</Link>
              ))}
            </div>
          </nav>
          <nav aria-label={t("footer.colNext")} className="site-footer-column" data-area="next" data-reveal-item>
            <h2 className="site-footer-title" data-align={align("titles")}>{t("footer.colNext")}</h2>
            <div className="site-footer-links" data-align={align("links")}>
              {NEXT.map((key) => (
                <Link key={key} href={pages.path(key)}>{pages.name(key)}</Link>
              ))}
            </div>
          </nav>
          <div className="site-footer-column" data-area="info" data-reveal-item>
            <h2 className="site-footer-title" data-align={align("titles")}>{t("footer.colVisit")}</h2>
            <address className="site-footer-links" data-align={align("links")}>
              {social.messenger && <a href={social.messenger} target="_blank" rel="noreferrer">{t("footer.messenger")}</a>}
              {social.whatsapp && (
                <a href={social.whatsapp} target="_blank" rel="noreferrer">
                  {whatsapp ? `${t("footer.writeTo")} ${whatsapp}` : t("footer.whatsapp")}
                </a>
              )}
              {email && <a href={`mailto:${email}`} className="site-footer-email">{email}</a>}
              {settings.address && <span className="site-footer-place">{settings.address}</span>}
              {settings.sunday && <span>{settings.sunday}</span>}
              {settings.wednesday && <span>{settings.wednesday}</span>}
            </address>
          </div>
        </Rise>

        <Rise className="site-footer-bottom" delay={120}>
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
