import { HeroFilm } from "@/Components/site/hero-film";
import type { MediaAsset } from "@/lib/media";
import type { SiteSettings } from "@/lib/types";
import { useSitePages } from "@/lib/site-pages";

export function HomeHero({ settings, asset }: { settings: SiteSettings; asset: MediaAsset }) {
  const pages = useSitePages();
  return (
    <HeroFilm asset={asset} sunday={settings.sunday} wednesday={settings.wednesday}>
      <p className="text-[11px] font-medium uppercase tracking-[0.32em] text-white/80">{settings.city}</p>
      <h1 className="editorial mt-4 max-w-3xl text-[2.6rem] leading-[1.02] text-white sm:text-6xl lg:text-7xl">
        {settings.heroTitle}
      </h1>
      <p className="mt-5 max-w-xl text-[15px] font-light leading-7 text-white/85 sm:mt-6 sm:text-lg sm:leading-8">
        {settings.heroSubtitle}
      </p>
      <a href="#planifica" className="btn-accent mt-7 inline-flex self-start rounded-full px-6 py-3 text-sm font-semibold sm:mt-9">
        {pages.name("visit")}
      </a>
    </HeroFilm>
  );
}
