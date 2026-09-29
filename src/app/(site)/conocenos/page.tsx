import type { Metadata } from "next";
import { getSettings } from "@/lib/content";

export const metadata: Metadata = { title: "Conócenos" };

export default async function AboutPage() {
  const settings = await getSettings();
  return (
    <article className="mx-auto max-w-6xl px-5 py-20">
      <p className="text-xs uppercase tracking-[0.22em] text-muted">Conócenos</p>
      <h1 className="display mt-3 max-w-3xl text-5xl md:text-6xl">Una iglesia local, una sola familia.</h1>
      <div className="mt-14 grid items-center gap-12 md:grid-cols-2">
        <img src="/images/pastores.jpg" alt={settings.pastorsLabel} className="w-full rounded-[2rem] bg-white object-contain" />
        <div>
          <p className="text-sm uppercase tracking-[0.18em] text-muted">Pastores</p>
          <h2 className="display mt-2 text-4xl">{settings.pastorsLabel}</h2>
          <p className="mt-5 text-lg leading-8 text-muted">{settings.aboutText}</p>
        </div>
      </div>
      <div className="mt-20 grid gap-12 md:grid-cols-2">
        <section>
          <h2 className="display text-4xl">Nuestra historia</h2>
          <p className="mt-5 leading-8 text-muted">{settings.history}</p>
        </section>
        <section>
          <h2 className="display text-4xl">Visión</h2>
          <p className="mt-5 leading-8 text-muted">{settings.vision}</p>
        </section>
      </div>
      <section className="mt-20">
        <h2 className="display text-4xl">Valores</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-4">
          {settings.values.map((value) => (
            <div key={value.title} className="rounded-[1.5rem] border border-line bg-card p-6">
              <h3 className="text-xl font-medium">{value.title}</h3>
              <p className="mt-3 text-sm leading-6 text-muted">{value.text}</p>
            </div>
          ))}
        </div>
      </section>
    </article>
  );
}
