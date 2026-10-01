import Link from "next/link";
import { SkinSwitch } from "@/components/site/skin-switch";
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
      <div className="grid gap-12 md:grid-cols-12">
        <div className="md:col-span-4">
          <p className="text-lg font-medium tracking-tight text-[#1a1a1a]">iglesia zoe</p>
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
          <Link href="/ingresar" className="block text-muted">Grupos pequeños</Link>
          <Link href="/dar" className="block text-muted">Generosidad</Link>
        </div>
        <div className="text-sm leading-7 md:col-span-3">
          <p className="kicker">Visítanos</p>
          <p className="mt-3">{settings.address}</p>
          <p className="text-muted">{settings.sunday}</p>
          <p className="text-muted">{settings.wednesday}</p>
          {settings.facebook && (
            <a href={settings.facebook} className="mt-3 block text-muted" target="_blank" rel="noreferrer">
              Facebook
            </a>
          )}
          {other && (
            <div className="mt-5">
              <SkinSwitch href={other.href} label={other.label} invert={other.invert} />
            </div>
          )}
        </div>
      </div>
    </footer>
  );
}
