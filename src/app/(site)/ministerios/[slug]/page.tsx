import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Rise } from "@/components/motion/rise";
import { LeadTitle } from "@/components/site/lead-title";
import { PageBand } from "@/components/site/media-view";
import { getMinistries } from "@/lib/content";
import { getSiteMedia } from "@/lib/media-server";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const ministries = await getMinistries();
  const ministry = ministries.find((item) => item.slug === slug);
  return { title: ministry?.name || "Ministerio" };
}

export default async function MinistryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [ministries, media] = await Promise.all([getMinistries(), getSiteMedia()]);
  const ministry = ministries.find((item) => item.slug === slug);
  if (!ministry) notFound();
  return (
    <article className="page-wrap">
      <Rise>
        <Link href="/ministerios" className="text-sm text-muted transition hover:text-ink">Ministerios</Link>
      </Rise>
      <div className="mt-10 grid items-center gap-10 lg:mt-14 lg:grid-cols-2 lg:gap-20">
        <Rise>
          <p className="kicker">{ministry.age_range}</p>
          <LeadTitle text={ministry.name} className="mt-4 text-6xl md:text-7xl lg:text-8xl" />
          <p className="mt-8 max-w-xl text-lg font-light leading-8 text-muted">{ministry.body}</p>
          <Link href="/visita" className="mt-10 inline-block rounded-full bg-ink px-6 py-3 text-sm font-medium text-white">
            Planifica tu visita
          </Link>
        </Rise>
        <Rise delay={140}>
          <PageBand asset={media.ministry(ministry.slug, ministry.name)} ratio="aspect-[16/10] lg:aspect-[4/5]" />
        </Rise>
      </div>
    </article>
  );
}
