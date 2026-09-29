import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getMinistries } from "@/lib/content";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const ministries = await getMinistries();
  const ministry = ministries.find((item) => item.slug === slug);
  return { title: ministry?.name || "Ministerio" };
}

export default async function MinistryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ministries = await getMinistries();
  const ministry = ministries.find((item) => item.slug === slug);
  if (!ministry) notFound();
  return (
    <article className="mx-auto max-w-3xl px-5 py-20">
      <Link href="/ministerios" className="text-sm text-muted">Ministerios</Link>
      <p className="mt-8 text-sm uppercase tracking-[0.2em] text-muted">{ministry.age_range}</p>
      <h1 className="display mt-3 text-6xl">{ministry.name}</h1>
      <p className="mt-8 text-xl font-light leading-9">{ministry.body}</p>
      <Link href="/visita" className="mt-10 inline-block rounded-full bg-ink px-6 py-3 text-sm font-medium text-white">
        Planifica tu visita
      </Link>
    </article>
  );
}
