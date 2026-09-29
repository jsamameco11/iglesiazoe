import type { Metadata } from "next";
import Link from "next/link";
import { getMinistries } from "@/lib/content";

export const metadata: Metadata = { title: "Ministerios" };

export default async function MinistriesPage() {
  const ministries = await getMinistries();
  return (
    <article className="mx-auto max-w-6xl px-5 py-20">
      <p className="text-xs uppercase tracking-[0.22em] text-muted">Ministerios</p>
      <h1 className="display mt-3 max-w-3xl text-5xl md:text-6xl">Un lugar para cada etapa de la vida.</h1>
      <p className="mt-6 max-w-2xl text-lg leading-8 text-muted">
        Desde los niños hasta los matrimonios, hay una comunidad donde puedes pertenecer, crecer y servir.
      </p>
      <div className="mt-12 grid gap-5 md:grid-cols-2">
        {ministries.map((ministry) => (
          <Link
            key={ministry.slug}
            href={`/ministerios/${ministry.slug}`}
            className="rounded-[1.75rem] border border-line p-8"
            style={{ background: `linear-gradient(160deg, ${ministry.accent}, #fffcf9 55%)` }}
          >
            <p className="text-sm text-muted">{ministry.age_range}</p>
            <h2 className="display mt-2 text-5xl">{ministry.name}</h2>
            <p className="mt-5 max-w-md leading-7">{ministry.body}</p>
          </Link>
        ))}
      </div>
    </article>
  );
}
