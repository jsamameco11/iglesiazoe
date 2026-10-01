import { Header } from "@/Components/site/header";
import { Footer } from "@/Components/site/footer";
import { SkinScroll } from "@/Components/site/skin-scroll";
import { MessengerFab } from "@/Components/site/messenger-fab";
import { useSitePalette } from "@/Components/site/palette-scope";
import { usePage } from "@inertiajs/react";
import { useEffect } from "react";
import type { Ministry, SiteSettings } from "@/lib/types";
import type { Design } from "@/lib/design";

type Shared = {
  settings: SiteSettings;
  ministries: Ministry[];
  skin: "aire" | "marea";
  design?: Design;
};

export default function SiteLayout({
  children,
  overMedia = false,
}: {
  children: React.ReactNode;
  overMedia?: boolean | "split" | "page";
}) {
  const { settings, ministries, skin, design } = usePage<{ props: Shared }>().props as unknown as Shared;
  const { style, attrs } = useSitePalette();
  const isMarea = skin === "marea";
  const other = isMarea
    ? { href: "https://iglesiacristianazoe.miacademiapreu.com", label: "Ver opción Casa", invert: true }
    : { href: "https://iglesiacristianazoe2.miacademiapreu.com", label: "Ver opción Luz", invert: false };

  useEffect(() => {
    if (!design?.fontHref) return;
    const id = "zoe-site-fonts";
    let link = document.getElementById(id) as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      document.head.appendChild(link);
    }
    link.href = design.fontHref;
  }, [design?.fontHref]);

  return (
    <div
      data-skin={skin}
      data-font={settings.fontPair || "mixed"}
      {...attrs}
      className="min-h-screen overflow-x-hidden"
      style={{ ...style, color: style["--muted"] } as React.CSSProperties}
    >
      <SkinScroll skin={skin} />
      <Header
        ministries={ministries}
        home="/"
        other={other}
        overMedia={overMedia}
        visitCta={settings.visitCta}
      />
      <main>{children}</main>
      <Footer settings={settings} other={other} />
      <MessengerFab />
    </div>
  );
}
