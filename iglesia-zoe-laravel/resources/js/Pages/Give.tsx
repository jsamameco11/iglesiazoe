import { useState } from "react";
import { Rise } from "@/Components/motion/rise";
import { LeadTitle } from "@/Components/site/lead-title";
import { PageBand } from "@/Components/site/media-view";
import { PageIntro } from "@/Components/site/page-intro";
import SiteLayout from "@/Layouts/SiteLayout";
import { readCopy, type CopyKey } from "@/lib/copy";
import { resolveMedia, type MediaAsset } from "@/lib/media";
import type { SiteSettings } from "@/lib/types";

function Account({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="mt-5">
      <p className="text-[11px] uppercase tracking-[0.18em] text-muted">{label}</p>
      <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-lg font-light tabular-nums">{value}</span>
        <button
          type="button"
          onClick={copy}
          className="text-[11px] uppercase tracking-[0.18em] text-muted underline decoration-line underline-offset-4 transition hover:text-ink"
        >
          {copied ? "Copiado" : "Copiar"}
        </button>
      </div>
    </div>
  );
}

export default function Give({
  settings,
  mediaOverrides,
  skin,
}: {
  settings: SiteSettings;
  mediaOverrides: Record<string, MediaAsset>;
  skin: "aire" | "marea";
}) {
  const media = resolveMedia(mediaOverrides);
  const t = (key: CopyKey) => readCopy(settings, key);
  const cardUrl = settings.cardUrl?.trim();
  const accounts = [
    { label: t("give.soles"), value: settings.bankSoles },
    { label: t("give.solesCci"), value: settings.bankSolesCci },
    { label: t("give.dollars"), value: settings.bankDollars },
    { label: t("give.dollarsCci"), value: settings.bankDollarsCci },
  ].filter((account) => account.value.trim() !== "");

  return (
    <SiteLayout>
      <article className="page-wrap">
        <Rise>
          <PageIntro skin={skin} kicker={t("give.kicker")} title={settings.giveTitle} media={<PageBand asset={media.giving} />}>
            <p className="ital mt-5 max-w-xl text-2xl text-muted">{settings.giveLead}</p>
            <p className="mt-6 max-w-xl text-lg font-light leading-8 text-muted">{settings.giveBody}</p>
          </PageIntro>
        </Rise>
        <div className={`mt-20 grid gap-6 md:grid-cols-2 ${cardUrl ? "lg:grid-cols-3" : ""}`}>
          <Rise>
            <div className="panel h-full p-8">
              <LeadTitle as="h2" text={t("give.transferTitle")} className="text-3xl" />
              <p className="mt-2 text-sm text-muted">{t("give.bank")}</p>
              {accounts.length > 0 ? (
                accounts.map((account) => <Account key={account.label} label={account.label} value={account.value} />)
              ) : (
                <p className="mt-5 text-sm text-muted">{t("give.empty")}</p>
              )}
              {settings.bankHolder ? (
                <p className="mt-6 border-t border-line pt-5 text-sm leading-6 text-muted">
                  {t("give.holder")} {settings.bankHolder}
                </p>
              ) : null}
            </div>
          </Rise>
          <Rise delay={100}>
            <div className="panel h-full p-8">
              <LeadTitle as="h2" text={t("give.yapeTitle")} className="text-3xl" />
              <p className="mt-4 text-sm leading-6 text-muted">{settings.giveYapeText}</p>
              {settings.yapeQr ? (
                <figure className="mt-7">
                  <img
                    src={settings.yapeQr}
                    alt="Código QR para yapear a Iglesia Cristiana Zoe"
                    width={588}
                    height={588}
                    loading="lazy"
                    className="w-full max-w-[220px]"
                  />
                  <figcaption className="mt-3 text-[11px] uppercase tracking-[0.18em] text-muted">
                    {t("give.qrCaption")}
                  </figcaption>
                </figure>
              ) : null}
              {settings.yape ? <p className="display mt-7 text-4xl">{settings.yape}</p> : null}
              {settings.yapeHolder ? <p className="mt-3 text-sm leading-6 text-muted">{settings.yapeHolder}</p> : null}
            </div>
          </Rise>
          {cardUrl ? (
            <Rise delay={200}>
              <div className="panel flex h-full flex-col p-8">
                <LeadTitle as="h2" text={t("give.cardTitle")} className="text-3xl" />
                {settings.giveCardText ? <p className="mt-4 text-sm leading-6 text-muted">{settings.giveCardText}</p> : null}
                <a href={cardUrl} target="_blank" rel="noreferrer" className="mt-8 w-fit rounded-full bg-accent px-6 py-3 text-sm font-medium text-white">
                  {t("give.cardButton")}
                </a>
              </div>
            </Rise>
          ) : null}
        </div>
      </article>
    </SiteLayout>
  );
}
