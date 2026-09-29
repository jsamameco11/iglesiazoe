import Link from "next/link";
import type { SiteSettings } from "@/lib/types";

export function Footer({ settings }: { settings: SiteSettings }) {
  return (
    <footer className="border-t border-line bg-paper">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 md:grid-cols-4">
        <div className="md:col-span-2">
          <p className="script text-5xl leading-none">Zoe</p>
          <p className="mt-4 max-w-sm text-sm leading-6 text-muted">
            Iglesia Cristiana Zoe. Una sola familia, en Chiclayo, donde el amor de Dios se hace casa.
          </p>
        </div>
        <div className="text-sm leading-7">
          <p className="font-medium">Visítanos</p>
          <p className="text-muted">{settings.address}</p>
          <p className="text-muted">{settings.sunday}</p>
          <p className="text-muted">{settings.wednesday}</p>
        </div>
        <div className="text-sm leading-7">
          <p className="font-medium">Conecta</p>
          <Link href="/contacto" className="block text-muted hover:text-ink">Oración y contacto</Link>
          <Link href="/dar" className="block text-muted hover:text-ink">Generosidad</Link>
          <Link href="/ingresar" className="block text-muted hover:text-ink">Grupos celulares</Link>
          {settings.facebook && (
            <a href={settings.facebook} className="block text-muted hover:text-ink" target="_blank" rel="noreferrer">Facebook</a>
          )}
        </div>
      </div>
      <div className="border-t border-line px-5 py-5 text-center text-xs text-muted">
        Iglesia Cristiana Zoe · Chiclayo
      </div>
    </footer>
  );
}
