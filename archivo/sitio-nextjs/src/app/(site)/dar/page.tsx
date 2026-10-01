import type { Metadata } from "next";
import { Rise } from "@/components/motion/rise";
import { LeadTitle } from "@/components/site/lead-title";
import { PageBand } from "@/components/site/media-view";
import { getSettings } from "@/lib/content";
import { getSiteMedia } from "@/lib/media-server";

export const metadata: Metadata = { title: "Dar" };

function Account({ label, value }: { label: string; value: string }) {
  return (
    <p className="mt-5 text-sm">
      <span className="text-[11px] uppercase tracking-[0.18em] text-muted">{label}</span>
      <span className="mt-1 block text-lg font-light">{value || "Dato por confirmar"}</span>
    </p>
  );
}

export default async function GivePage() {
  const [settings, media] = await Promise.all([getSettings(), getSiteMedia()]);
  return (
    <article className="page-wrap">
      <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
        <Rise>
          <p className="kicker">Generosidad</p>
          <LeadTitle text={settings.giveTitle} className="mt-4 max-w-xl text-5xl md:text-7xl" />
          <p className="ital mt-5 max-w-xl text-2xl text-muted">{settings.giveLead}</p>
          <p className="mt-6 max-w-xl text-lg font-light leading-8 text-muted">{settings.giveBody}</p>
        </Rise>
        <Rise delay={120}>
          <PageBand asset={media.giving} />
        </Rise>
      </div>
      <div className="mt-20 grid gap-6 md:grid-cols-3">
        <Rise>
          <div className="panel h-full p-8">
          <LeadTitle as="h2" text="Transferencia" className="text-3xl" />
          <p className="mt-2 text-sm text-muted">Banco BCP</p>
          <Account label="Soles" value={settings.bankSoles} />
          <Account label="CCI soles" value={settings.bankSolesCci} />
          <Account label="Dólares" value={settings.bankDollars} />
          <Account label="CCI dólares" value={settings.bankDollarsCci} />
          </div>
        </Rise>
        <Rise delay={100}>
          <div className="panel h-full p-8">
          <LeadTitle as="h2" lead="Yape /" accent="Plin" className="text-3xl" />
          <p className="mt-4 text-sm leading-6 text-muted">{settings.giveYapeText}</p>
          <p className="display mt-8 text-4xl">{settings.yape || "Número por confirmar"}</p>
          </div>
        </Rise>
        <Rise delay={180}>
          <div className="panel h-full p-8">
          <LeadTitle as="h2" accent="Tarjeta" className="text-3xl" />
          <p className="mt-4 text-sm leading-6 text-muted">{settings.giveCardText}</p>
          {settings.cardUrl ? (
            <a href={settings.cardUrl} className="mt-8 inline-block rounded-full bg-ink px-5 py-3 text-sm font-medium text-white" target="_blank" rel="noreferrer">
              Dar con tarjeta
            </a>
          ) : (
            <p className="mt-8 text-sm text-muted">El botón de pago se activa cuando el administrador conecta la pasarela.</p>
          )}
          </div>
        </Rise>
      </div>
    </article>
  );
}
