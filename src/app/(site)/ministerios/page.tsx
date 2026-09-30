import type { Metadata } from "next";
import Link from "next/link";
import { Rise } from "@/components/motion/rise";
import { LeadTitle } from "@/components/site/lead-title";
import { MediaView } from "@/components/site/media-view";
import { getMinistries } from "@/lib/content";
import { getSiteMedia } from "@/lib/media-server";

export const metadata: Metadata = { title: "Ministerios" };

export default async function MinistriesPage() {
  const [ministries, media] = await Promise.all([getMinistries(), getSiteMedia()]);
  return (
    <article className="pb-16">
      <div className="page-wrap pb-0">
        <Rise>
          <p className="text-[11px] uppercase tracking-[0.28em] text-muted">Ministerios</p>
          <LeadTitle lead="Un lugar para cada etapa" accent="de la vida." className="mt-4 max-w-4xl text-5xl md:text-7xl" />
          <p className="mt-6 max-w-xl text-lg font-light leading-8 text-muted">
            Desde los niños hasta los matrimonios, hay una comunidad donde puedes pertenecer, crecer y servir.
          </p>
        </Rise>
      </div>
      <div className="stack mt-12 px-4 md:px-12 lg:px-20">
        {ministries.map((ministry) => (
          <Rise key={ministry.slug}>
            <Link href={`/ministerios/${ministry.slug}`} className="panel grid items-center gap-6 p-4 md:grid-cols-2 md:p-6">
                <div className="order-2 md:order-1">
                  <MediaView asset={media.ministry(ministry.slug, ministry.name)} />
                </div>
                <div className="order-1 px-3 py-4 md:order-2 md:px-6">
                  <p className="text-sm text-muted">{ministry.age_range}</p>
                  <LeadTitle as="h2" text={ministry.name} className="mt-3 text-5xl md:text-6xl" />
                  <p className="mt-6 max-w-md text-lg font-light leading-8">{ministry.body}</p>
                </div>
            </Link>
          </Rise>
        ))}
      </div>
    </article>
  );
}
