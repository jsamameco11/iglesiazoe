import { Footer } from "@/components/site/footer";
import { Header } from "@/components/site/header";
import { getMinistries, getSettings } from "@/lib/content";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [settings, ministries] = await Promise.all([getSettings(), getMinistries()]);
  return (
    <>
      <Header ministries={ministries} />
      <main>{children}</main>
      <Footer settings={settings} />
    </>
  );
}
