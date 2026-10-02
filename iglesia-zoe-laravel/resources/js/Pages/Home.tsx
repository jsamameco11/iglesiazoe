import { CellsSection } from "@/Components/site/home/cells";
import { EssenceSection } from "@/Components/site/home/essence";
import { EventsSection } from "@/Components/site/home/events";
import { GenerationsSection } from "@/Components/site/home/generations";
import { HomeHero } from "@/Components/site/home/hero";
import { ResourcesSection } from "@/Components/site/home/resources";
import { VisitSection } from "@/Components/site/home/visit";
import { ServeRail } from "@/Components/site/serve-rail";
import SiteLayout from "@/Layouts/SiteLayout";
import { resolveMedia, type MediaAsset } from "@/lib/media";
import type { ChurchEvent, Ministry, SermonSummary, ServeArea, SiteSettings } from "@/lib/types";

export default function Home({
  settings,
  ministries,
  serveAreas,
  sermons,
  events,
  mediaOverrides,
  skin,
}: {
  settings: SiteSettings;
  ministries: Ministry[];
  serveAreas: ServeArea[];
  sermons: SermonSummary[];
  events: ChurchEvent[];
  mediaOverrides: Record<string, MediaAsset>;
  skin: "aire" | "marea";
}) {
  const media = resolveMedia(mediaOverrides);
  const split = skin === "marea";
  return (
    <SiteLayout overMedia={split ? "split" : true}>
      <HomeHero settings={settings} asset={media.hero} split={split} />
      <EssenceSection settings={settings} />
      <CellsSection settings={settings} asset={media.homeCells} />
      <GenerationsSection settings={settings} ministries={ministries} media={media} />
      <ServeRail title={settings.serveRailTitle} text={settings.serveRailText} areas={serveAreas} />
      <EventsSection settings={settings} events={events} fallback={media.events} />
      <ResourcesSection settings={settings} sermons={sermons} />
      <VisitSection settings={settings} />
    </SiteLayout>
  );
}
