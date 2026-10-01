import { headers } from "next/headers";
import { Footer } from "@/components/site/footer";
import { Header } from "@/components/site/header";
import { SkinScroll } from "@/components/site/skin-scroll";
import { getMinistries, getSettings } from "@/lib/content";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [settings, ministries, requestHeaders] = await Promise.all([
    getSettings(),
    getMinistries(),
    headers(),
  ]);
  const host = requestHeaders.get("host") || "";
  const isMareaDomain = host.toLowerCase().startsWith("iglesiacristianazoe2.");
  const other = isMareaDomain
    ? { href: "https://iglesiacristianazoe.miacademiapreu.com", label: "Ver opción Casa", invert: true }
    : { href: "https://iglesiacristianazoe2.miacademiapreu.com", label: "Ver opción Luz", invert: false };
  const skin = isMareaDomain ? "marea" : "aire";
  return (
    <div
      data-skin={skin}
      data-font={settings.fontPair || "mixed"}
      className="min-h-screen overflow-x-hidden"
      style={{ ["--ink" as string]: settings.headingColor, ["--muted" as string]: settings.bodyColor, color: settings.bodyColor }}
    >
      <SkinScroll skin={skin} />
      <Header ministries={ministries} home="/" other={other} overMedia={isMareaDomain ? "split" : true} visitCta={settings.visitCta} />
      <main>{children}</main>
      <Footer settings={settings} other={other} />
    </div>
  );
}
