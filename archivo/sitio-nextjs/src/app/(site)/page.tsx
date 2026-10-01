import { headers } from "next/headers";
import { AireHome } from "@/propuestas/aire/home";
import { MareaHome } from "@/propuestas/marea/home";
import { getMinistries, getSettings } from "@/lib/content";
import { getSiteMedia } from "@/lib/media-server";

export default async function HomePage() {
  const [settings, ministries, media, requestHeaders] = await Promise.all([
    getSettings(),
    getMinistries(),
    getSiteMedia(),
    headers(),
  ]);
  const host = requestHeaders.get("host") || "";
  const isMareaDomain = host.toLowerCase().startsWith("iglesiacristianazoe2.");
  return isMareaDomain
    ? <MareaHome settings={settings} ministries={ministries} media={media} />
    : <AireHome settings={settings} ministries={ministries} media={media} />;
}
