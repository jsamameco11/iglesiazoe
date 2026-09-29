import type { Metadata } from "next";
import { getSettings } from "@/lib/content";

export const metadata: Metadata = { title: "Dar" };

function Account({ label, value }: { label: string; value: string }) {
  return (
    <p className="mt-3 text-sm">
      <span className="text-muted">{label}</span>
      <span className="mt-1 block font-medium">{value || "Dato por confirmar"}</span>
    </p>
  );
}

export default async function GivePage() {
  const settings = await getSettings();
  return (
    <article className="mx-auto max-w-6xl px-5 py-20">
      <p className="text-xs uppercase tracking-[0.22em] text-muted">Generosidad</p>
      <h1 className="display mt-3 max-w-3xl text-5xl md:text-6xl">Generosidad que transforma vidas</h1>
      <p className="mt-4 text-xl font-light text-muted">Sé parte de lo que Dios está haciendo en nuestra iglesia y comunidad.</p>
      <p className="mt-6 max-w-3xl leading-8">
        Creemos que dar es un acto de adoración, gratitud y obediencia a Dios. Gracias a tu generosidad y fidelidad, podemos seguir llevando el mensaje de amor, sosteniendo la obra de la iglesia y ayudando a quienes más lo necesitan. ¡Dios ama al dador alegre!
      </p>
      <div className="mt-12 grid gap-4 md:grid-cols-3">
        <section className="rounded-[1.75rem] border border-line bg-card p-6">
          <h2 className="text-lg font-medium">Transferencias bancarias</h2>
          <p className="mt-1 text-sm text-muted">Banco BCP</p>
          <Account label="Soles" value={settings.bankSoles} />
          <Account label="CCI soles" value={settings.bankSolesCci} />
          <Account label="Dólares" value={settings.bankDollars} />
          <Account label="CCI dólares" value={settings.bankDollarsCci} />
        </section>
        <section className="rounded-[1.75rem] border border-line bg-card p-6">
          <h2 className="text-lg font-medium">Yape / Plin</h2>
          <p className="mt-4 text-sm leading-6 text-muted">Escanea el QR en recepción o envía tu aporte al número de la iglesia.</p>
          <p className="mt-6 text-3xl font-light">{settings.yape || "Número por confirmar"}</p>
        </section>
        <section className="rounded-[1.75rem] border border-line bg-card p-6">
          <h2 className="text-lg font-medium">Tarjeta de crédito o débito</h2>
          <p className="mt-4 text-sm leading-6 text-muted">Aporta en línea con la pasarela de pagos de la iglesia.</p>
          {settings.cardUrl ? (
            <a href={settings.cardUrl} className="mt-8 inline-block rounded-full bg-orange px-5 py-3 text-sm font-medium text-white" target="_blank" rel="noreferrer">
              Dar con tarjeta
            </a>
          ) : (
            <p className="mt-8 text-sm text-muted">El botón de pago se activa cuando el administrador conecta la pasarela.</p>
          )}
        </section>
      </div>
    </article>
  );
}
