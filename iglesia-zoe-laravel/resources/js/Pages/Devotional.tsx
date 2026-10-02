import { Link } from "@inertiajs/react";
import { useState } from "react";
import { Rise } from "@/Components/motion/rise";
import { DevotionalCard } from "@/Components/site/devotional-card";
import SiteLayout from "@/Layouts/SiteLayout";
import { readCopy, type CopyKey } from "@/lib/copy";
import { resolveMedia, type MediaAsset } from "@/lib/media";
import type { Devotional as DevotionalCardData, DevotionalFull, SiteSettings } from "@/lib/types";
import { formatSermonDate } from "@/lib/youtube";
import { section } from "@/lib/design";

function Body({ text }: { text: string }) {
  const paragraphs = text.split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean);
  return (
    <div className="devo-body">
      {paragraphs.map((paragraph, index) => (
        <p key={index}>
          {paragraph.split("\n").map((line, at) => (
            <span key={at}>
              {at ? <br /> : null}
              {line}
            </span>
          ))}
        </p>
      ))}
    </div>
  );
}

export default function Devotional({
  devotional,
  more,
  settings,
  mediaOverrides,
}: {
  devotional: DevotionalFull;
  more: DevotionalCardData[];
  settings: SiteSettings;
  mediaOverrides: Record<string, MediaAsset>;
}) {
  const t = (key: CopyKey) => readCopy(settings, key);
  const cover = resolveMedia(mediaOverrides).devotionals.src;
  const image = devotional.image || cover;
  const [copied, setCopied] = useState(false);
  const url = typeof window === "undefined" ? "" : window.location.href;
  const whatsapp = `https://wa.me/?text=${encodeURIComponent(`${devotional.title} · Devocional de Iglesia Cristiana Zoe\n${url}`)}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopied(false);
    }
  }

  return (
    <SiteLayout>
      <article className="page-wrap">
        <div {...section("reading", "Lectura")} className="mx-auto max-w-3xl">
          <Rise>
            <Link href="/devocionales" className="text-sm text-muted transition hover:text-ink">← {t("devotionals.back")}</Link>
            <p className="kicker mt-10">
              {formatSermonDate(devotional.publish_on)} · {devotional.minutes} {t("devotionals.minutes")}
            </p>
            <h1 className="editorial mt-4 text-5xl leading-[1.04] md:text-6xl">{devotional.title}</h1>
            {devotional.author ? <p className="mt-4 text-[15px] text-muted">{devotional.author}</p> : null}
          </Rise>

          {image ? (
            <Rise>
              <figure className="devo-figure">
                <img src={image} alt="" />
              </figure>
            </Rise>
          ) : null}

          {devotional.verse_text || devotional.verse_ref ? (
            <Rise>
              <blockquote className="devo-quote">
                {devotional.verse_text ? <p>«{devotional.verse_text}»</p> : null}
                {devotional.verse_ref ? <cite>{devotional.verse_ref}</cite> : null}
              </blockquote>
            </Rise>
          ) : null}

          <Rise>
            <Body text={devotional.body} />
          </Rise>

          <Rise className="mt-12 flex flex-wrap items-center gap-3 border-t border-ink/10 pt-8">
            <a href={whatsapp} target="_blank" rel="noreferrer" className="btn-accent inline-flex rounded-full px-5 py-2.5 text-sm font-semibold">
              {t("devotionals.share")}
            </a>
            <button type="button" onClick={copy} className="rounded-full border border-ink/15 px-5 py-2.5 text-sm font-semibold text-ink transition hover:border-ink/40">
              {copied ? t("devotionals.copied") : t("devotionals.copy")}
            </button>
          </Rise>
        </div>

        <Rise {...section("prayer", "Invitación a orar")} className="ink-band mt-20 rounded-[2rem] px-8 py-14 md:px-14">
          <div className="flex flex-wrap items-end justify-between gap-8">
            <h2 className="editorial max-w-xl text-4xl leading-[1.05] text-white md:text-5xl">{t("devotionals.prayer")}</h2>
            <Link href="/contacto" className="btn-accent rounded-full px-6 py-3 text-sm font-semibold">{t("devotionals.prayerCta")} →</Link>
          </div>
        </Rise>

        {more.length ? (
          <section {...section("more", "Más devocionales")} className="mt-20">
            <Rise className="flex flex-wrap items-end justify-between gap-6">
              <h2 className="editorial text-3xl md:text-4xl">{t("devotionals.more")}</h2>
              <Link href="/devocionales" className="home-link">{t("devotionals.back")} →</Link>
            </Rise>
            <div className="mt-8 grid gap-5 md:grid-cols-3">
              {more.map((item) => (
                <DevotionalCard key={item.id} item={item} cover={cover} t={t} />
              ))}
            </div>
          </section>
        ) : null}
      </article>
    </SiteLayout>
  );
}
