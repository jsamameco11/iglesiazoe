import Link from "next/link";
import { Rise } from "@/components/motion/rise";
import { HeroFilm } from "@/components/site/hero-film";
import { MediaView } from "@/components/site/media-view";
import { LeadTitle } from "@/components/site/lead-title";
import { PhotoRail } from "@/components/site/photo-rail";
import type { ResolvedMedia } from "@/lib/media";
import type { Ministry, SiteSettings } from "@/lib/types";

export function AireHome({
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
      <HeroFilm asset={media.hero}>
        <p className="text-[11px] font-medium uppercase tracking-[0.32em] text-white">{settings.city}</p>
        <h1 className="display mt-4 max-w-4xl text-5xl text-white sm:text-7xl" style={{ color: "#fff" }}>{settings.heroTitle}</h1>
        <p className="mt-5 max-w-xl text-lg font-light leading-8 text-white">{settings.heroSubtitle}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/visita" className="rounded-full bg-white px-6 py-3 text-sm font-medium text-ink">Planifica tu visita</Link>
          <Link href="/predicas" className="rounded-full px-6 py-3 text-sm font-medium text-white ring-1 ring-white/50">Ver prédicas</Link>
        </div>
      </HeroFilm>

      <PhotoRail
        title="Somos una iglesia que está en movimiento"
        text="Contribuimos con nuestra ciudad. Llevamos esperanza, fe y el mensaje de Jesús a cada persona."
        items={media.gallery}
      />

      <div className="stack px-4 py-8 md:px-8 lg:px-12">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Rise delay={0}>
            <Link href="/visita" className="swatch flex h-full min-h-[132px] items-center justify-center px-5 text-center" style={{ background: "var(--sage)", color: "#1f2024" }}>
              <span className="editorial text-[1.35rem] italic leading-tight md:text-[1.7rem]">Campus y horarios</span>
            </Link>
          </Rise>
          <Rise delay={80}>
            <Link href="/ministerios" className="swatch flex h-full min-h-[132px] flex-col items-center justify-center gap-2 px-5 text-center" style={{ background: "var(--amber)", color: "#1f2024" }}>
              <span className="inline-flex h-7 items-end gap-[3px]" aria-hidden>
                <i className="block h-3 w-[2px] bg-current" />
                <i className="block h-5 w-[2px] bg-current" />
                <i className="block h-7 w-[2px] bg-current" />
                <i className="block h-4 w-[2px] bg-current" />
              </span>
              <span className="text-[11px] font-medium uppercase tracking-[0.42em]">Crecer</span>
            </Link>
          </Rise>
          <Rise delay={160}>
            <Link href="/ingresar" className="swatch flex h-full min-h-[132px] items-center justify-center px-5 text-center" style={{ background: "var(--clay)", color: "#1f2024" }}>
              <span className="text-[1.05rem] font-medium uppercase leading-tight tracking-[0.18em] md:text-[1.2rem]">Grupos<br />pequeños</span>
            </Link>
          </Rise>
          <Rise delay={240}>
            <Link href="/bautismos" className="swatch flex h-full min-h-[132px] items-center justify-center px-5 text-center" style={{ background: "var(--dusk)", color: "#1f2024" }}>
              <span className="script text-5xl md:text-6xl">Bautismo</span>
            </Link>
          </Rise>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          {[
            ["Domingo", settings.sunday, "var(--sage)", "#1f2024"],
            ["Entre semana", settings.wednesday, "var(--amber)", "#1f2024"],
            ["Estamos en", settings.address, "var(--dusk)", "#1f2024"],
          ].map(([label, value, color, ink], index) => (
            <Rise key={label} delay={index * 90}>
              <div className="swatch h-full px-7 py-8" style={{ background: color, color: ink }}>
                <p className="text-[11px] uppercase tracking-[0.24em] opacity-60">{label}</p>
                <p className="editorial mt-4 text-3xl italic">{value}</p>
              </div>
            </Rise>
          ))}
        </div>

        {ministries.map((ministry) => (
          <Rise key={ministry.slug}>
            <Link href={`/ministerios/${ministry.slug}`} className="panel grid items-center gap-6 p-4 md:grid-cols-2 md:p-6">
              <div className="order-2 md:order-1">
                <MediaView asset={media.ministry(ministry.slug, ministry.name)} />
              </div>
              <div className="order-1 px-3 py-4 md:order-2 md:px-6">
                <p className="text-sm text-muted">{ministry.age_range}</p>
                <LeadTitle as="h3" text={ministry.name} className="mt-2 text-4xl md:text-5xl" />
                <p className="mt-3 max-w-md leading-7 text-muted">{ministry.summary}</p>
              </div>
            </Link>
          </Rise>
        ))}

        <div className="grid gap-4 md:grid-cols-3">
          {[
            ["/visita", "Planifica tu visita", "Te esperamos. Cuéntanos que vienes y te recibimos.", "var(--sage)", "#1f2024"],
            ["/bautismos", "Tu nuevo comienzo", "El bautismo es el siguiente paso público de tu fe.", "var(--dusk)", "#1f2024"],
            ["/contacto", "Podemos orar por ti", "Escribe tu petición. Queremos acompañarte.", "var(--clay)", "#1f2024"],
          ].map(([href, title, text, color, ink], index) => (
            <Rise key={href} delay={index * 90}>
              <Link href={href} className="swatch block h-full p-8" style={{ background: color, color: ink }}>
                <h2 className="display text-4xl">{title}</h2>
                <p className="mt-4 leading-7 opacity-80">{text}</p>
              </Link>
            </Rise>
          ))}
        </div>
      </div>
    </>
  );
}
