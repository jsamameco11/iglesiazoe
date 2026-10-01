import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Rise } from "@/components/motion/rise";
import { LeadTitle } from "@/components/site/lead-title";
import { PageBand } from "@/components/site/media-view";
import { getMinistries, getSettings } from "@/lib/content";
import { getSiteMedia } from "@/lib/media-server";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const ministries = await getMinistries();
  const ministry = ministries.find((item) => item.slug === slug);
  return { title: ministry?.name || "Ministerio" };
}

export default async function MinistryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [ministries, media, settings] = await Promise.all([getMinistries(), getSiteMedia(), getSettings()]);
  const ministry = ministries.find((item) => item.slug === slug);
  if (!ministry) notFound();
  return (
    <article className="page-wrap">
      <Rise>
        <Link href="/ministerios" className="text-sm text-muted transition hover:text-ink">Ministerios</Link>
      </Rise>
      <div className="mt-10 grid items-center gap-8 md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.85fr)] md:gap-12 lg:mt-14 lg:gap-16">
        <Rise>
          <p className="kicker">{ministry.age_range}</p>
          <LeadTitle text={ministry.name} className="mt-4 text-6xl md:text-7xl lg:text-8xl" />
          <p className="mt-8 max-w-xl text-lg font-light leading-8 text-muted">{ministry.body}</p>
          <Link href="/visita" className="mt-10 inline-block rounded-full bg-ink px-6 py-3 text-sm font-medium text-white">
            {settings.visitCta}
          </Link>
        </Rise>
        <Rise delay={140}>
          <PageBand asset={media.ministry(ministry.slug, ministry.name)} />
        </Rise>
      </div>
    </article>
  );
}
