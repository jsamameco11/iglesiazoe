
import { Link, usePage } from "@inertiajs/react";
import { useEffect, useState } from "react";
import { NotifyBell, NotifyCard } from "@/Components/site/notify-bell";
import { AccessButton } from "@/Components/site/skin-switch";
import { useCopy } from "@/lib/copy";
import { LIVE_HREF, useOnAir } from "@/lib/live";
import { useSitePages, type PageLink } from "@/lib/site-pages";
import type { Ministry, ServeArea } from "@/lib/types";

type NavLink = PageLink;

function LiveButton({ ghost, className = "live-pill" }: { ghost?: boolean; className?: string }) {
  const onAir = useOnAir();
  const t = useCopy();
  return (
    <Link
      href={LIVE_HREF}
      tabIndex={ghost ? -1 : undefined}
      className={className}
      data-on-air={onAir || undefined}
      aria-label={onAir ? `${t("nav.live")}: transmitiendo ahora` : t("nav.live")}
    >
      <span className="live-dot" aria-hidden />
      {t("nav.live")}
    </Link>
  );
}

function RadioPill({ ghost }: { ghost?: boolean }) {
  const pages = useSitePages();
  return (
    <Link href={pages.path("radio")} tabIndex={ghost ? -1 : undefined} className="radio-pill hidden sm:inline-flex">
      <span className="nav-radio-dot" aria-hidden />
      {pages.name("radio")}
    </Link>
  );
}

function useServeAreas() {
  return (usePage().props as unknown as { serveAreas?: ServeArea[] }).serveAreas ?? [];
}

function useNavLinks() {
  const pages = useSitePages();
  const serve = [pages.link("serve"), ...pages.children("serve")];
  const studies = pages.children("studies");
  const resources = pages.children("resources");
  const mobile = [
    pages.link("about"),
    pages.link("ministries"),
    ...serve,
    ...studies,
    pages.link("events"),
    ...resources,
    pages.link("radio"),
    pages.link("contact"),
    pages.link("give"),
  ];
  return { serve, studies, resources, mobile };
}

type MegaItem = { href: string; title: string; note: string | null };
type PillLink = { href: string; label: string };

function usePillDrops() {
  return (usePage().props as unknown as { skin?: string }).skin === "marea";
}

function PillDrop({ links, onClose }: { links: PillLink[]; onClose: () => void }) {
  return (
    <div className="pill-drop">
      {links.map((link, index) => (
        <Link
          key={link.href}
          href={link.href}
          onClick={onClose}
          onBlur={index === links.length - 1 ? onClose : undefined}
          className="pill-drop-item"
          style={{ "--i": index } as React.CSSProperties}
        >
          <span className="truncate">{link.label}</span>
        </Link>
      ))}
    </div>
  );
}

function MegaDrop({
  label,
  href,
  kicker,
  title,
  all,
  items,
  footer,
  ghost,
  active,
}: {
  label: string;
  href: string;
  kicker: string;
  title: string;
  all: string;
  items: MegaItem[];
  footer?: NavLink[];
  ghost?: boolean;
  active: boolean;
}) {
  const [open, setOpen] = useState(false);
  const pills = usePillDrops();
  return (
    <div className="relative" onMouseEnter={() => !ghost && setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <Link
        href={href}
        className={`inline-flex items-center gap-1.5 transition hover:opacity-60 ${active ? "nav-current" : ""}`}
        tabIndex={ghost ? -1 : undefined}
        onFocus={() => !ghost && setOpen(true)}
      >
        {label}
        <span className={`text-[8px] transition ${open ? "rotate-180" : ""}`}>▼</span>
      </Link>
      {!ghost && open && pills && (
        <PillDrop
          links={[...items.map((item) => ({ href: item.href, label: item.title })), ...(footer ?? [])]}
          onClose={() => setOpen(false)}
        />
      )}
      {!ghost && open && !pills && (
        <div className="absolute left-1/2 top-full w-[620px] -translate-x-1/2 pt-4 text-ink">
          <div className="nav-drop overflow-hidden rounded-[1.4rem] border border-black/5 bg-card shadow-[0_30px_80px_rgba(23,24,28,0.12)]">
            <div className="flex items-end justify-between border-b border-black/5 px-6 py-4">
              <div>
                <p className="text-[10.5px] uppercase tracking-[0.22em] text-muted">{kicker}</p>
                <p className="editorial mt-1 text-2xl italic">{title}</p>
              </div>
              <Link href={href} className="text-[13px] font-medium" onClick={() => setOpen(false)}>{all}</Link>
            </div>
            <div className="grid grid-cols-2 gap-px bg-black/5">
              {items.map((item, index) => (
                <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className="nav-drop-item bg-card px-6 py-4">
                  <p className="text-[10.5px] tracking-[0.18em] text-muted">{String(index + 1).padStart(2, "0")}</p>
                  <p className="mt-1.5 text-[1.15rem] font-medium tracking-[-0.03em]">{item.title}</p>
                  {item.note ? <p className="mt-0.5 text-[13px] text-muted">{item.note}</p> : null}
                </Link>
              ))}
              {items.length % 2 === 1 ? <span className="bg-card" aria-hidden /> : null}
            </div>
            {footer?.length ? (
              <div className="flex flex-wrap items-center gap-2 border-t border-black/5 px-6 py-3.5">
                {footer.map((link, index) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setOpen(false)}
                    onBlur={index === footer.length - 1 ? () => setOpen(false) : undefined}
                    className={index === 0 ? "rounded-full bg-accent px-4 py-2 text-[13px] font-semibold text-white" : "nav-drop-item rounded-full px-3 py-2 text-[13px] font-medium"}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

function NavDrop({ label, href, links, ghost, active }: { label: string; href: string; links: NavLink[]; ghost?: boolean; active: boolean }) {
  const [open, setOpen] = useState(false);
  const pills = usePillDrops();
  return (
    <div className="relative" onMouseEnter={() => !ghost && setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <Link
        href={href}
        className={`inline-flex items-center gap-1.5 transition hover:opacity-60 ${active ? "nav-current" : ""}`}
        tabIndex={ghost ? -1 : undefined}
        onFocus={() => !ghost && setOpen(true)}
      >
        {label}
        <span className={`text-[8px] transition ${open ? "rotate-180" : ""}`}>▼</span>
      </Link>
      {!ghost && open && pills && <PillDrop links={links} onClose={() => setOpen(false)} />}
      {!ghost && open && !pills && (
        <div className="absolute left-1/2 top-full w-[300px] -translate-x-1/2 pt-4 text-ink">
          <div className="nav-drop overflow-hidden rounded-[1.25rem] border border-black/5 bg-card p-2 shadow-[0_24px_60px_rgba(23,24,28,0.14)]">
            {links.map((link) => (
              <Link key={link.href} href={link.href} onBlur={() => setOpen(false)} className="nav-drop-item block rounded-[0.9rem] px-4 py-3">
                <span className="block text-[15px] font-medium tracking-[-0.02em]">{link.label}</span>
                <span className="mt-0.5 block text-[12.5px] text-muted">{link.note}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function HeaderBar({
  ministries,
  home,
  lightCta,
  ghost,
  menuOpen,
  onToggleMenu,
  pathname,
}: {
  ministries: Ministry[];
  home: string;
  lightCta: boolean;
  ghost?: boolean;
  menuOpen: boolean;
  onToggleMenu?: () => void;
  pathname: string;
}) {
  const t = useCopy();
  const pages = useSitePages();
  const areas = useServeAreas().filter((area) => area.accepts_volunteers);
  const { serve, studies, resources } = useNavLinks();
  const here = (prefix: string) => pathname === prefix || pathname.startsWith(prefix + "/");
  const current = (prefix: string) => (here(prefix) ? "nav-current" : "");
  const ghostTab = ghost ? -1 : undefined;
  const plain = (key: "about" | "events" | "contact" | "give") => (
    <Link href={pages.path(key)} className={`transition hover:opacity-60 ${current(pages.path(key))}`} tabIndex={ghostTab}>{pages.name(key)}</Link>
  );

  return (
    <div className="flex h-[72px] items-center justify-between gap-3 px-5 sm:gap-6 md:px-10">
      <Link href={home} className="shrink-0 whitespace-nowrap text-[1.3rem] font-semibold tracking-[-0.03em] text-current" tabIndex={ghostTab}>
        {t("nav.brand")}
      </Link>
      <nav className="site-nav hidden items-center gap-[1.15rem] text-current xl:flex 2xl:gap-6">
        {plain("about")}
        <MegaDrop
          label={pages.name("ministries")}
          href={pages.path("ministries")}
          kicker={t("nav.dropKicker")}
          title={t("nav.dropTitle")}
          all={t("nav.dropAll")}
          items={ministries.map((ministry) => ({ href: `/ministerios/${ministry.slug}`, title: ministry.name, note: ministry.age_range }))}
          ghost={ghost}
          active={here("/ministerios")}
        />
        {areas.length ? (
          <MegaDrop
            label={pages.name("serve")}
            href={pages.path("serve")}
            kicker={t("nav.serveDropKicker")}
            title={t("nav.serveDropTitle")}
            all={t("nav.dropAll")}
            items={areas.map((area) => ({ href: `/involucrate/${area.slug}`, title: area.name, note: area.tagline }))}
            footer={serve.slice(1)}
            ghost={ghost}
            active={serve.some((link) => here(link.href))}
          />
        ) : (
          <NavDrop label={pages.name("serve")} href={pages.path("serve")} links={serve} ghost={ghost} active={serve.some((link) => here(link.href))} />
        )}
        <NavDrop label={pages.name("studies")} href={pages.path("studies")} links={studies} ghost={ghost} active={studies.some((link) => here(link.href))} />
        {plain("events")}
        <NavDrop label={pages.name("resources")} href={pages.path("resources")} links={resources} ghost={ghost} active={resources.some((link) => here(link.href))} />
        <Link href={pages.path("radio")} className={`nav-radio transition hover:opacity-60 ${current(pages.path("radio"))}`} tabIndex={ghostTab}>
          <span className="nav-radio-dot" aria-hidden />
          {pages.name("radio")}
        </Link>
        {plain("contact")}
        {plain("give")}
      </nav>
      <div className="hidden items-center gap-4 xl:flex">
        <NotifyBell ghost={ghost} />
        <LiveButton ghost={ghost} />
        <AccessButton ghost={ghost} invert={lightCta} />
        <Link href={pages.path("visit")} tabIndex={ghostTab} className="rounded-full bg-accent px-4 py-2 text-[14px] font-semibold text-white">
          {pages.name("visit")}
        </Link>
      </div>
      <div className="flex items-center gap-2 sm:gap-3 xl:hidden">
        <RadioPill ghost={ghost} />
        <NotifyBell ghost={ghost} />
        <LiveButton ghost={ghost} />
        <AccessButton ghost={ghost} invert={lightCta} />
        <button
          type="button"
          className="menu-toggle flex h-11 w-11 items-center justify-center rounded-full border border-current/20"
          onClick={ghost ? undefined : onToggleMenu}
          tabIndex={ghostTab}
          aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"}
          aria-expanded={menuOpen}
          data-open={menuOpen || undefined}
        >
          <span className="menu-toggle-lines" aria-hidden>
            <span />
            <span />
          </span>
        </button>
      </div>
    </div>
  );
}

function MobileMenu({ home, pathname, onClose }: { home: string; pathname: string; onClose: () => void }) {
  const t = useCopy();
  const pages = useSitePages();
  const { mobile } = useNavLinks();
  return (
    <>
      <button type="button" className="menu-scrim xl:hidden" aria-label="Cerrar menú" onClick={onClose} />
      <div className="menu-sheet xl:hidden" role="dialog" aria-modal="true" aria-label="Menú">
        <nav className="menu-list">
          {mobile.map((item, index) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className="menu-row"
                data-active={active || undefined}
                style={{ "--i": index } as React.CSSProperties}
              >
                <span className="menu-row-label">{item.label}</span>
                <span className="menu-row-note">{item.note}</span>
              </Link>
            );
          })}
        </nav>
        <div className="menu-foot" style={{ "--i": mobile.length } as React.CSSProperties}>
          <div className="min-w-0">
            <p className="menu-foot-kicker">{t("nav.menuKicker")}</p>
            <p className="menu-foot-title">{t("nav.menuTitle")}</p>
          </div>
          <Link href={pages.path("visit")} onClick={onClose} className="btn-accent shrink-0 rounded-full px-4 py-2.5 text-[13px] font-semibold">
            {pages.name("visit")}
          </Link>
        </div>
        <div className="sm:hidden">
          <NotifyCard />
        </div>
        <div className="menu-links">
          <Link href={home} onClick={onClose}>{pages.name("home")}</Link>
          <Link href="/acceso" onClick={onClose}>{t("nav.access")} →</Link>
        </div>
      </div>
    </>
  );
}

export function Header({
  ministries,
  home = "/",
  overMedia = false,
}: {
  ministries: Ministry[];
  home?: string;
  other?: { href: string; label: string; invert?: boolean };
  overMedia?: boolean | "split" | "page";
}) {
  const pathname = usePage().url.split("?")[0];
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const limit = overMedia ? window.innerHeight * 0.72 : 24;
      setScrolled(window.scrollY > limit);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [overMedia]);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    const onResize = () => window.innerWidth >= 1280 && setOpen(false);
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
    };
  }, [open]);

  const onHome = (pathname === home || overMedia === "page") && !open;
  const splitHero = overMedia === "split" && onHome && !scrolled;
  const onHero = Boolean(overMedia) && onHome && !scrolled;

  const bar = {
    ministries,
    home,
    menuOpen: open,
    onToggleMenu: () => setOpen((value) => !value),
    pathname,
  };

  return (
    <header className="fixed inset-x-0 top-0 z-50">
      {!onHero && (
        <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[72px] bg-paper/92 backdrop-blur-sm" />
      )}

      {splitHero ? (
        <>
          <div className="header-split-media absolute inset-x-0 top-0 z-10 text-white lg:clip-left">
            <HeaderBar {...bar} lightCta />
          </div>
          <div className="header-split-paper relative text-ink lg:clip-right">
            <HeaderBar {...bar} lightCta={false} />
          </div>
        </>
      ) : (
        <div style={{ color: onHero ? "#fff" : "var(--ink)" }}>
          <HeaderBar {...bar} lightCta={onHero} />
        </div>
      )}

      {open && <MobileMenu home={home} pathname={pathname} onClose={() => setOpen(false)} />}
    </header>
  );
}
