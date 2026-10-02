import { Rise } from "@/Components/motion/rise";
import { SectionHead } from "@/Components/site/home/section";
import { IconClock, IconPin } from "@/Components/site/icons";
import { VisitForm } from "@/Components/site/visit-form";
import { mapEmbedUrl } from "@/lib/contact";
import { readCopy } from "@/lib/copy";
import type { SiteSettings } from "@/lib/types";

export function VisitSection({ settings }: { settings: SiteSettings }) {
  const address = settings.address.trim();
  return (
    <section id="planifica" className="home-section home-sand scroll-mt-[72px]">
      <div className="home-split is-visit items-start">
        <Rise>
          <SectionHead kicker={readCopy(settings, "home.visitKicker")} title={settings.visitInviteTitle} />
          <p className="mt-6 max-w-lg text-lg font-light leading-8 text-muted">{settings.visitInviteText}</p>
          <dl className="home-facts">
            <div>
              <dt><IconPin /> {readCopy(settings, "facts.place")}</dt>
              <dd>
                {address}
                {settings.city ? <span className="block text-muted">{settings.city}</span> : null}
              </dd>
            </div>
            <div>
              <dt><IconClock /> {readCopy(settings, "facts.sunday")}</dt>
              <dd>
                {settings.sunday}
                {settings.wednesday ? <span className="block text-muted">{settings.wednesday}</span> : null}
              </dd>
            </div>
          </dl>
          <div className="home-map is-wide shot mt-10">
            <iframe title="Cómo llegar a Iglesia Cristiana Zoe" src={mapEmbedUrl(address)} loading="lazy" />
          </div>
          {settings.mapUrl ? (
            <a href={settings.mapUrl} target="_blank" rel="noreferrer" className="home-link mt-5">
              {readCopy(settings, "contact.map")} →
            </a>
          ) : null}
        </Rise>
        <Rise delay={120}>
          <div className="home-visit-card">
            <div className="home-visit-card-head">
              <h3 className="text-2xl font-semibold tracking-[-0.02em]">{readCopy(settings, "home.visitFormTitle")}</h3>
              <p className="mt-2 text-sm leading-6 text-muted">{readCopy(settings, "home.visitFormText")}</p>
            </div>
            <VisitForm cta={settings.visitCta} sunday={settings.sunday} wednesday={settings.wednesday} />
          </div>
        </Rise>
      </div>
    </section>
  );
}
