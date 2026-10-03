import { useState } from "react";
import { Rise } from "@/Components/motion/rise";
import { IconBank, IconCard, IconGlobe, IconPhoneQr } from "@/Components/site/icons";
import { LeadTitle } from "@/Components/site/lead-title";
import { PageBand } from "@/Components/site/media-view";
import SiteLayout from "@/Layouts/SiteLayout";
import { readCopy, readPairs, type CopyKey } from "@/lib/copy";
import { resolveMedia, type MediaAsset } from "@/lib/media";
import { talkUrlOf } from "@/lib/social";
import type { SiteSettings } from "@/lib/types";
import { section } from "@/lib/design";
import { useSitePages } from "@/lib/site-pages";

function CopyRow({ label, value, mono = true }: { label: string; value: string; mono?: boolean }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value.replace(/\s+/g, mono ? "" : " ").trim());
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="copy-row">
      <div className="min-w-0">
        <p className="text-[10.5px] uppercase tracking-[0.18em] opacity-60">{label}</p>
        <p className={`mt-1 text-[0.9rem] leading-snug [overflow-wrap:anywhere] sm:text-[1.05rem] ${mono ? "tabular-nums sm:tracking-[0.02em]" : ""}`}>{value}</p>
      </div>
      <button type="button" onClick={copy} className="copy-btn" data-done={copied || undefined} aria-label={`Copiar ${label}`}>
        {copied ? "Copiado ✓" : "Copiar"}
      </button>
    </div>
  );
}

export default function Give({
  settings,
  mediaOverrides,
}: {
  settings: SiteSettings;
  mediaOverrides: Record<string, MediaAsset>;
}) {
  const pages = useSitePages();
  const media = resolveMedia(mediaOverrides);
  const t = (key: CopyKey) => readCopy(settings, key);
  const verse = readPairs(settings, "give.verse")[0];
  const cardUrl = settings.cardUrl?.trim();
  const accounts = [
    { label: t("give.soles"), value: settings.bankSoles },
    { label: t("give.solesCci"), value: settings.bankSolesCci },
    { label: t("give.dollars"), value: settings.bankDollars },
    { label: t("give.dollarsCci"), value: settings.bankDollarsCci },
  ].filter((account) => account.value.trim() !== "");
  const abroadAccount = settings.bankDollars.trim()
    ? { label: t("give.dollars"), value: settings.bankDollars }
    : settings.bankSoles.trim()
      ? { label: t("give.soles"), value: settings.bankSoles }
      : null;
  const hasYape = Boolean(settings.yapeQr || settings.yape);
  const hasAbroad = Boolean(settings.bankSwift.trim() && abroadAccount);

  const chips = [
    { href: "#transferencia", label: t("give.transferTitle") },
    hasYape ? { href: "#yape", label: t("give.yapeTitle") } : null,
    hasAbroad ? { href: "#extranjero", label: t("give.abroadTitle") } : null,
    cardUrl ? { href: "#tarjeta", label: t("give.cardTitle") } : null,
  ].filter((chip): chip is { href: string; label: string } => chip !== null);

  return (
    <SiteLayout>
      <article className="page-wrap">
        <header {...section("intro", "Portada")} className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
          <Rise>
            <p className="kicker">{pages.kicker("give")}</p>
            <LeadTitle text={settings.giveTitle} className="mt-4 text-5xl md:text-7xl" />
            <p className="ital mt-5 max-w-xl text-2xl text-muted">{settings.giveLead}</p>
            {settings.giveBody ? <p className="mt-4 max-w-md text-base font-light leading-7">{settings.giveBody}</p> : null}
            <nav className="give-chips mt-8" aria-label={pages.section("give", "ways")}>
              {chips.map((chip) => (
                <a key={chip.href} href={chip.href} className="give-chip">
                  <i aria-hidden />
                  {chip.label}
                </a>
              ))}
            </nav>
          </Rise>
          <Rise from="right" className="give-hero-figure">
            <PageBand asset={media.giving} />
            {verse ? (
              <blockquote className="give-verse">
                <p className="editorial text-[1.15rem] italic leading-snug text-ink">«{verse.text}»</p>
                {verse.ref ? <footer className="mt-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">{verse.ref}</footer> : null}
              </blockquote>
            ) : null}
          </Rise>
        </header>

        <section {...section("ways", "Formas de dar")} className="mt-24 md:mt-28">
          <Rise>
            <p className="kicker">{pages.section("give", "ways")}</p>
          </Rise>
          <div className={`mt-8 grid gap-5 md:grid-cols-2 ${hasYape && hasAbroad ? "lg:grid-cols-3" : ""}`}>
            <div id="transferencia" className="bank-card scroll-mt-28">
              <div className="flex items-center justify-between gap-4">
                <span className="give-icon"><IconBank /></span>
                <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/60">{t("give.bank")}</span>
              </div>
              <h2 className="mt-6 text-[1.7rem] font-medium tracking-[-0.03em] text-white">{t("give.transferTitle")}</h2>
              <div className="mt-3">
                {accounts.length ? (
                  accounts.map((account) => <CopyRow key={account.label} label={account.label} value={account.value} />)
                ) : (
                  <p className="py-3 text-sm text-white/70">{t("give.empty")}</p>
                )}
              </div>
              {settings.bankHolder ? (
                <p className="relative z-10 mt-2 text-[13px] text-white/60">
                  {t("give.holder")} <span className="text-white">{settings.bankHolder}</span>
                </p>
              ) : null}
            </div>

            {hasYape ? (
              <div id="yape" className="give-card scroll-mt-28">
                <span className="give-icon"><IconPhoneQr /></span>
                <h2 className="mt-6 text-[1.7rem] font-medium tracking-[-0.03em] text-ink">{t("give.yapeTitle")}</h2>
                {settings.giveYapeText ? <p className="mt-2 text-[0.95rem] leading-6">{settings.giveYapeText}</p> : null}
                <div className="mt-6 flex flex-1 flex-wrap items-end gap-x-5 gap-y-3">
                  {settings.yapeQr ? (
                    <figure className="m-0 shrink-0">
                      <img src={settings.yapeQr} alt="Código QR para yapear a Iglesia Cristiana Zoe" width={588} height={588} loading="lazy" className="w-32 rounded-2xl border border-line bg-white p-2 sm:w-36" />
                      <figcaption className="mt-2 text-[10px] uppercase tracking-[0.16em] text-muted">{t("give.qrCaption")}</figcaption>
                    </figure>
                  ) : null}
                  <div className="min-w-[9rem] flex-1 sm:pb-6">
                    {settings.yape ? <p className="display text-3xl tabular-nums">{settings.yape}</p> : null}
                    {settings.yapeHolder ? <p className="mt-2 text-[13px] leading-5 text-muted">{settings.yapeHolder}</p> : null}
                  </div>
                </div>
              </div>
            ) : null}

            {hasAbroad && abroadAccount ? (
              <div id="extranjero" className="give-card scroll-mt-28">
                <div className="flex items-center justify-between gap-4">
                  <span className="give-icon"><IconGlobe /></span>
                  <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">{t("give.bank")}</span>
                </div>
                <h2 className="mt-6 text-[1.7rem] font-medium tracking-[-0.03em] text-ink">{t("give.abroadTitle")}</h2>
                {settings.giveAbroadText ? <p className="mt-2 text-[0.95rem] leading-6">{settings.giveAbroadText}</p> : null}
                <div className="mt-3 text-ink">
                  <CopyRow label={t("give.swift")} value={settings.bankSwift} />
                  <CopyRow label={abroadAccount.label} value={abroadAccount.value} />
                  {settings.bankHolder ? <CopyRow label={t("give.holder")} value={settings.bankHolder} mono={false} /> : null}
                </div>
                <div className="mt-auto pt-5">
                  <a href={talkUrlOf(settings, t("give.abroadMessage"))} target="_blank" rel="noreferrer" className="btn-accent inline-flex rounded-full px-5 py-2.5 text-[13px] font-semibold">
                    {t("give.abroadConfirm")} →
                  </a>
                </div>
              </div>
            ) : null}
          </div>

          {cardUrl ? (
            <Rise>
              <div id="tarjeta" className="give-card give-card-wide mt-5 scroll-mt-28">
                <div className="flex items-center gap-5">
                  <span className="give-icon shrink-0"><IconCard /></span>
                  <div>
                    <h2 className="text-[1.4rem] font-medium tracking-[-0.03em] text-ink">{t("give.cardTitle")}</h2>
                    {settings.giveCardText ? <p className="mt-1 text-[0.95rem] leading-6">{settings.giveCardText}</p> : null}
                  </div>
                </div>
                <a href={cardUrl} target="_blank" rel="noreferrer" className="btn-accent mt-5 w-fit shrink-0 rounded-full px-6 py-3 text-sm font-semibold md:mt-0">
                  {t("give.cardButton")}
                </a>
              </div>
            </Rise>
          ) : null}
        </section>
      </article>
    </SiteLayout>
  );
}
