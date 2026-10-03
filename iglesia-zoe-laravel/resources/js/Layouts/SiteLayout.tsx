import { Header } from "@/Components/site/header";
import { Footer } from "@/Components/site/footer";
import { SkinScroll } from "@/Components/site/skin-scroll";
import { MessengerFab } from "@/Components/site/messenger-fab";
import { usePage } from "@inertiajs/react";
import { useRef } from "react";
import { useAutoReveal } from "@/Components/motion/auto-reveal";
import "../../css/sections.css";
import { useArt, useSiteDesign } from "@/lib/design";
import type { Ministry, SiteSettings } from "@/lib/types";

type Shared = {
  settings: SiteSettings;
  ministries: Ministry[];
  skin: "aire" | "marea";
};

export default function SiteLayout({
  children,
  overMedia = false,
}: {
  children: React.ReactNode;
  overMedia?: boolean | "split" | "page";
}) {
  const { settings, ministries, skin } = usePage<{ props: Shared }>().props as unknown as Shared;
  const { style, attrs } = useSiteDesign();
  const reveal = useArt("reveal");
  const revealRoot = useRef<HTMLDivElement>(null);
  useAutoReveal(revealRoot, { off: reveal.still, speed: reveal.speed });
  const isMarea = skin === "marea";
  const other = isMarea
    ? { href: "https://iglesiacristianazoe.miacademiapreu.com", label: "Ver opción Casa", invert: true }
    : { href: "https://iglesiacristianazoe2.miacademiapreu.com", label: "Ver opción Luz", invert: false };

  return (
    <div
      data-skin={skin}
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
      />
      <div ref={revealRoot}>
        <main>{children}</main>
        <Footer settings={settings} other={other} />
      </div>
      <MessengerFab />
    </div>
  );
}
