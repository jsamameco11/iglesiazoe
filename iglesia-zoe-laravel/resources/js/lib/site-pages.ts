import { usePage } from "@inertiajs/react";

export type PageKey =
  | "home"
  | "about"
  | "ministries"
  | "serve"
  | "register"
  | "baptism"
  | "studies"
  | "route"
  | "classroom"
  | "events"
  | "resources"
  | "gallery"
  | "devotionals"
  | "sermons"
  | "teachings"
  | "games"
  | "radio"
  | "contact"
  | "give"
  | "visit";

export type SiteSection = { key: string; name: string };

/** A public page as named in Páginas y secciones (site_pages / site_sections). */
export type SitePage = {
  key: PageKey;
  parent: PageKey | null;
  path: string;
  name: string;
  note: string;
  kicker: string;
  sections: SiteSection[];
};

export type PageLink = { href: string; label: string; note: string };

export function useSitePages() {
  const { sitePages = [] } = usePage().props as unknown as { sitePages?: SitePage[] };
  const find = (key: PageKey) => sitePages.find((page) => page.key === key);
  const link = (page: SitePage): PageLink => ({ href: page.path, label: page.name, note: page.note });

  return {
    pages: sitePages,
    name: (key: PageKey) => find(key)?.name ?? "",
    note: (key: PageKey) => find(key)?.note ?? "",
    path: (key: PageKey) => find(key)?.path ?? "/",
    /** The small label above the page title; the page name when none is set. */
    kicker: (key: PageKey) => find(key)?.kicker || find(key)?.name || "",
    section: (key: PageKey, section: string) => find(key)?.sections.find((item) => item.key === section)?.name ?? "",
    link: (key: PageKey): PageLink => {
      const page = find(key);
      return page ? link(page) : { href: "/", label: "", note: "" };
    },
    /** The pages shown inside a menu group, in their catalog order. */
    children: (parent: PageKey) => sitePages.filter((page) => page.parent === parent).map(link),
  };
}
