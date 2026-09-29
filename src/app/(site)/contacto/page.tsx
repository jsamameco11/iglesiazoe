import type { Metadata } from "next";
import { PrayerForm } from "@/components/site/forms";
import { getSettings } from "@/lib/content";

export const metadata: Metadata = { title: "Contacto" };

export default async function ContactPage() {
  const settings = await getSettings();
  return (
    <article className="mx-auto grid max-w-6xl gap-12 px-5 py-20 md:grid-cols-2">
      <div>
        <p className="text-xs uppercase tracking-[0.22em] text-muted">Contacto y oración</p>
        <h1 className="display mt-3 text-5xl md:text-6xl">Estamos para acompañarte.</h1>
        <div className="mt-8 space-y-2 text-muted">
          <p>{settings.address}</p>
          <p>{settings.sunday}</p>
          <p>{settings.wednesday}</p>
          {settings.phone && <p>{settings.phone}</p>}
          {settings.email && <p>{settings.email}</p>}
        </div>
        <div className="mt-8 flex gap-4 text-sm font-medium">
          {settings.facebook && <a href={settings.facebook} target="_blank" rel="noreferrer">Facebook</a>}
          {settings.youtube && <a href={settings.youtube} target="_blank" rel="noreferrer">YouTube</a>}
          <a href={settings.mapUrl} target="_blank" rel="noreferrer">Cómo llegar</a>
        </div>
        <iframe
          title="Mapa"
          className="mt-8 h-64 w-full rounded-[1.75rem] border border-line"
          src={`https://maps.google.com/maps?q=${encodeURIComponent(settings.address)}&z=16&output=embed`}
        />
      </div>
      <div>
        <h2 className="display text-3xl">Petición de oración</h2>
        <div className="mt-6">
          <PrayerForm />
        </div>
      </div>
    </article>
  );
}
