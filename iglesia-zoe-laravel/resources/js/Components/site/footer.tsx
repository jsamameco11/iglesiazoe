import { Link } from "@inertiajs/react";
import { Rise } from "@/Components/motion/rise";
import { messengerUrl } from "@/lib/social";
import type { SiteSettings } from "@/lib/types";

export function Footer({
  settings,
  other,
}: {
  settings: SiteSettings;
  other?: { href: string; label: string; invert?: boolean };
}) {
  return (
    <footer className="border-t border-line px-6 py-20 md:px-16 lg:px-24">
      <Rise>
      <div className="grid gap-12 md:grid-cols-12">
        <div className="md:col-span-4">
          <p className="text-lg font-medium tracking-tight text-ink">iglesia zoe</p>
          <p className="mt-4 max-w-xs text-sm font-light leading-6 text-muted">
            {settings.footerTagline}
          </p>
        </div>
        <div className="text-sm leading-7 md:col-span-2">
          <p className="kicker">Conoce</p>
          <Link href="/conocenos" className="mt-3 block">Conócenos</Link>
          <Link href="/ministerios" className="block text-muted">Ministerios</Link>
          <Link href="/predicas" className="block text-muted">Prédicas</Link>
        </div>
        <div className="text-sm leading-7 md:col-span-3">
          <p className="kicker">Siguiente paso</p>
          <Link href="/visita" className="mt-3 block">{settings.visitCta}</Link>
          <Link href="/bautismos" className="block text-muted">Bautismo</Link>
          <Link href="/acceso" className="block text-muted">Acceso al sistema</Link>
          <Link href="/dar" className="block text-muted">Generosidad</Link>
        </div>
        <div className="text-sm leading-7 md:col-span-3">
          <p className="kicker">Visítanos</p>
          <p className="mt-3">{settings.address}</p>
          <p className="text-muted">{settings.sunday}</p>
          <p className="text-muted">{settings.wednesday}</p>
          <a href={messengerUrl} className="mt-3 block" target="_blank" rel="noreferrer">
            Escríbenos por Messenger
          </a>
          {settings.email && (
            <a href={`mailto:${settings.email.trim().toLowerCase()}`} className="block text-muted [overflow-wrap:anywhere]">
              {settings.email.trim().toLowerCase()}
            </a>
          )}
          {settings.facebook && (
            <a href={settings.facebook} className="block text-muted" target="_blank" rel="noreferrer">
              Facebook
            </a>
          )}
          {other && (
            <Link href={other.href} className="mt-5 block text-sm text-muted underline-offset-4 hover:underline">
              {other.label}
            </Link>
          )}
        </div>
      </div>
      </Rise>
    </footer>
  );
}
