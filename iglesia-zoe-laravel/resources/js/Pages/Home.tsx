import { CellsSection } from "@/Components/site/home/cells";
import { EssenceSection } from "@/Components/site/home/essence";
import { EventsSection } from "@/Components/site/home/events";
import { GenerationsSection } from "@/Components/site/home/generations";
import { HomeHero } from "@/Components/site/home/hero";
import { RadioSection } from "@/Components/site/home/radio";
import { ResourcesSection } from "@/Components/site/home/resources";
import { VisitSection } from "@/Components/site/home/visit";
import { ServeRail } from "@/Components/site/serve-rail";
import SiteLayout from "@/Layouts/SiteLayout";
import { resolveMedia, type MediaAsset } from "@/lib/media";
import type { RadioState } from "@/lib/radio";
import type { ChurchEvent, Ministry, SermonSummary, ServeArea, SiteSettings } from "@/lib/types";

export default function Home({
  settings,
  ministries,
  serveAreas,
  sermons,
  events,
  radio,
  mediaOverrides,
}: {
  settings: SiteSettings;
  ministries: Ministry[];
  serveAreas: ServeArea[];
  sermons: SermonSummary[];
  events: ChurchEvent[];
  radio: RadioState;
  mediaOverrides: Record<string, MediaAsset>;
}) {
  const media = resolveMedia(mediaOverrides);
  return (
    <SiteLayout overMedia>
      <HomeHero settings={settings} asset={media.hero} />
      <EssenceSection settings={settings} />
      <CellsSection settings={settings} asset={media.homeCells} />
      <GenerationsSection settings={settings} ministries={ministries} media={media} />
      <ServeRail title={settings.serveRailTitle} text={settings.serveRailText} areas={serveAreas} />
      <EventsSection settings={settings} events={events} fallback={media.events} />
      <RadioSection settings={settings} radio={radio} asset={media.radio} />
      <ResourcesSection settings={settings} sermons={sermons} />
      <VisitSection settings={settings} />
    </SiteLayout>
  );
}
