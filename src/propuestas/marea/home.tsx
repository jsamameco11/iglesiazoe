import Link from "next/link";
import { Rise } from "@/components/motion/rise";
import { HeroSplit } from "@/components/site/hero-film";
import { LeadTitle } from "@/components/site/lead-title";
import { MediaView } from "@/components/site/media-view";
import { PhotoRail } from "@/components/site/photo-rail";
import type { ResolvedMedia } from "@/lib/media";
import type { Ministry, SiteSettings } from "@/lib/types";

export function MareaHome({
  settings,
  ministries,
  media,
}: {
  settings: SiteSettings;
  ministries: Ministry[];
  media: ResolvedMedia;
}) {
  return (
    <>
      <HeroSplit asset={media.hero}>
        <p className="kicker">{settings.city}</p>
        <LeadTitle text={settings.heroTitle} className="mt-5 max-w-xl text-4xl sm:text-6xl lg:text-[4.4rem]" />
        <p className="mt-6 max-w-md text-lg font-light leading-8 text-muted">{settings.heroSubtitle}</p>
        <div className="mt-9 flex flex-wrap gap-3">
          <Link href="/visita" className="rounded-full bg-ink px-6 py-3 text-sm font-medium text-white">Planifica tu visita</Link>
          <Link href="/bautismos" className="rounded-full px-6 py-3 text-sm font-medium ring-1 ring-ink/15">Quiero bautizarme</Link>
        </div>
      </HeroSplit>

      <PhotoRail
        title="Somos una iglesia que está en movimiento"
        text="Contribuimos con nuestra ciudad. Llevamos esperanza, fe y el mensaje de Jesús a cada persona."
        items={media.gallery}
      />

      <div className="stack px-4 py-10 md:px-8 lg:px-12">
        <Rise>
          <section className="swatch px-7 py-12 md:px-14" style={{ background: "var(--sage)", color: "#1f2024" }}>
            <p className="text-[11px] uppercase tracking-[0.28em] opacity-55">{settings.pastorsLabel}</p>
            <p className="editorial mt-4 max-w-3xl text-4xl italic md:text-6xl">“{settings.aboutQuote}”</p>
          </section>
        </Rise>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            ["/visita", "Campus", settings.sunday, "var(--sage)", "#1f2024"],
            ["/ministerios", "Crecer", "Un lugar para cada edad", "var(--amber)", "#1f2024"],
            ["/ingresar", "Grupos", "Cada semana, en una casa", "var(--clay)", "#1f2024"],
            ["/bautismos", "Bautismo", "El siguiente paso de tu fe", "var(--dusk)", "#1f2024"],
          ].map(([href, label, value, color, ink], index) => (
            <Rise key={label} delay={index * 80}>
              <Link href={href} className="swatch block h-full px-7 py-8" style={{ background: color, color: ink }}>
                <p className="text-[11px] uppercase tracking-[0.24em] opacity-70">{label}</p>
                <p className="editorial mt-4 text-3xl">{value}</p>
              </Link>
            </Rise>
          ))}
        </div>

        <Rise>
          <section className="panel grid items-center gap-8 p-4 md:grid-cols-2 md:p-6">
            <div className="order-2 md:order-1">
              <MediaView asset={media.mareaFamily} />
            </div>
            <div className="order-1 px-4 py-6 md:order-2 md:px-8">
              <p className="text-[11px] uppercase tracking-[0.28em] text-muted">La casa</p>
              <LeadTitle as="h2" lead="Una familia que" accent="se reúne cada semana." className="mt-3 text-5xl md:text-6xl" />
              <p className="mt-5 max-w-md text-lg leading-8 text-muted">{settings.aboutText}</p>
            </div>
          </section>
        </Rise>

        <div className="grid gap-4 md:grid-cols-2">
          {[media.mareaCulto, media.mareaCiudad].map((asset) => (
            <Rise key={asset.src + asset.alt}>
              <figure className="panel p-3">
                <MediaView asset={asset} />
                <figcaption className="px-4 py-4 text-sm text-muted">{asset.alt}</figcaption>
              </figure>
            </Rise>
          ))}
        </div>

        <Rise>
          <section className="swatch px-7 py-10 md:px-12" style={{ background: "var(--amber)", color: "#1f2024" }}>
            <p className="text-[11px] uppercase tracking-[0.28em] opacity-55">Ministerios</p>
            <h2 className="editorial mt-3 text-5xl italic">Elige tu lugar.</h2>
            <ul className="mt-8">
              {ministries.map((ministry) => (
                <li key={ministry.slug} className="border-t border-ink/15">
                  <Link href={`/ministerios/${ministry.slug}`} className="flex items-baseline justify-between gap-6 py-5">
                    <span className="editorial text-3xl md:text-5xl">{ministry.name}</span>
                    <span className="shrink-0 text-sm text-muted">{ministry.age_range}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </Rise>

        <div className="grid gap-4 md:grid-cols-3">
          <Rise>
            <Link href="/visita" className="swatch block h-full p-8" style={{ background: "var(--sage)", color: "#1f2024" }}>
              <h3 className="editorial text-4xl italic">Visita</h3>
              <p className="mt-4 leading-7 opacity-75">Agenda tu primera vez y te recibimos en la puerta.</p>
            </Link>
          </Rise>
          <Rise>
            <Link href="/bautismos" className="swatch block h-full p-8" style={{ background: "var(--dusk)", color: "#1f2024" }}>
              <h3 className="script text-5xl">Bautismo</h3>
              <p className="mt-4 leading-7 opacity-75">Declara tu fe en el agua. Hay una charla previa.</p>
            </Link>
          </Rise>
          <Rise>
            <Link href="/dar" className="swatch block h-full p-8" style={{ background: "var(--clay)", color: "#1f2024" }}>
              <h3 className="editorial text-4xl italic">Generosidad</h3>
              <p className="mt-4 leading-7 opacity-75">Tu ofrenda sostiene la casa y alcanza a la ciudad.</p>
            </Link>
          </Rise>
        </div>
      </div>
    </>
  );
}
