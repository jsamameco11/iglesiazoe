import Link from "next/link";
import { getMinistries, getSettings } from "@/lib/content";

export default async function HomePage() {
  const [settings, ministries] = await Promise.all([getSettings(), getMinistries()]);
  return (
    <>
      <section className="relative min-h-[88vh] overflow-hidden bg-ink text-white">
        <img
          src="/images/banner8.jpg"
          alt="Congregación de Iglesia Cristiana Zoe"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/35 to-black/20" />
        <div className="relative mx-auto flex min-h-[88vh] max-w-6xl flex-col justify-end px-5 pb-16 pt-28">
          <p className="text-xs font-medium uppercase tracking-[0.28em] text-white/80">
            {settings.city}
          </p>
          <h1 className="display mt-5 max-w-4xl text-5xl text-white sm:text-6xl md:text-7xl">
            {settings.heroTitle}
          </h1>
          <p className="mt-6 max-w-xl text-lg font-light leading-8 text-white/85">{settings.heroSubtitle}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/visita" className="rounded-full bg-white px-6 py-3 text-sm font-medium text-ink">
              Planifica tu visita
            </Link>
            <Link href="/predicas" className="rounded-full border border-white/40 px-6 py-3 text-sm font-medium text-white">
              Ver prédicas
            </Link>
          </div>
        </div>
      </section>

      <section className="border-b border-line bg-card">
        <div className="mx-auto grid max-w-6xl md:grid-cols-3">
          {[
            ["Domingo", settings.sunday],
            ["Entre semana", settings.wednesday],
            ["Dónde estamos", settings.address],
          ].map(([label, value]) => (
            <div key={label} className="border-line px-5 py-8 md:border-l md:first:border-l-0">
              <p className="text-xs uppercase tracking-[0.22em] text-muted">{label}</p>
              <p className="mt-2 text-2xl font-light">{value}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-24">
        <div className="flex items-end justify-between gap-6">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-muted">Ministerios</p>
            <h2 className="display mt-3 text-4xl md:text-5xl">Conexión por etapas de vida</h2>
          </div>
          <Link href="/ministerios" className="hidden text-sm font-medium md:block">Ver todos</Link>
        </div>
        <div className="mt-10 grid gap-4 md:grid-cols-2">
          {ministries.map((ministry) => (
            <Link
              key={ministry.slug}
              href={`/ministerios/${ministry.slug}`}
              className="group rounded-[1.75rem] border border-line bg-card p-8 transition hover:-translate-y-0.5"
              style={{ background: `linear-gradient(180deg, ${ministry.accent}55, #fffcf9 42%)` }}
            >
              <p className="text-sm text-muted">{ministry.age_range}</p>
              <h3 className="display mt-3 text-4xl">{ministry.name}</h3>
              <p className="mt-4 max-w-md leading-7 text-muted">{ministry.summary}</p>
              <span className="mt-8 inline-block text-sm font-medium">Conocer este espacio →</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="bg-ink text-white">
        <div className="mx-auto max-w-4xl px-5 py-28 text-center">
          <p className="script text-5xl text-orange">Zoe</p>
          <p className="display mt-6 text-4xl leading-tight md:text-5xl">“{settings.aboutQuote}”</p>
          <Link href="/conocenos" className="mt-10 inline-block text-sm font-medium text-white/80">
            Conoce nuestra historia
          </Link>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-4 px-5 py-24 md:grid-cols-3">
        {[
          ["/visita", "Planifica tu visita", "Te esperamos este domingo. Cuéntanos que vienes y te recibimos."],
          ["/bautismos", "Tu nuevo comienzo", "El bautismo es el siguiente paso público de tu fe en Jesús."],
          ["/contacto", "¿Podemos orar por ti?", "Comparte tu petición. Estamos cerca y queremos acompañarte."],
        ].map(([href, title, text]) => (
          <Link key={href} href={href} className="rounded-[1.75rem] border border-line bg-card p-8">
            <h3 className="display text-3xl">{title}</h3>
            <p className="mt-4 leading-7 text-muted">{text}</p>
          </Link>
        ))}
      </section>
    </>
  );
}
