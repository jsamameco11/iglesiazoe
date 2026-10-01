import { Footer } from "@/components/site/footer";
import { Header } from "@/components/site/header";
import { SkinScroll } from "@/components/site/skin-scroll";
import { getMinistries, getSettings } from "@/lib/content";

export default async function MareaLayout({ children }: { children: React.ReactNode }) {
  const [settings, ministries] = await Promise.all([getSettings(), getMinistries()]);
  const other = { href: "/", label: "Ver opción Casa", invert: true };
  return (
    <div
      data-skin="marea"
      data-font={settings.fontPair || "mixed"}
      className="min-h-screen overflow-x-hidden"
      style={{ ["--ink" as string]: settings.headingColor, ["--muted" as string]: settings.bodyColor, color: settings.bodyColor }}
    >
      <SkinScroll skin="marea" />
      <Header ministries={ministries} home="/marea" other={other} overMedia="split" visitCta={settings.visitCta} />
      <main>{children}</main>
      <Footer settings={settings} other={other} />
    </div>
  );
}
