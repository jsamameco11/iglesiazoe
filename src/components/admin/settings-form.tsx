"use client";

import { useActionState } from "react";
import { saveSettings } from "@/app/actions/admin";
import type { SiteSettings } from "@/lib/types";

const field = "mt-1 w-full rounded-xl border border-line bg-white px-3 py-2";

export function SettingsForm({ settings, section }: { settings: SiteSettings; section: "contenido" | "generosidad" }) {
  const [state, action, pending] = useActionState(async (_: unknown, formData: FormData) => saveSettings(formData), undefined);
  return (
    <form action={action} className="grid max-w-3xl gap-4">
      <input type="hidden" name="current" value={JSON.stringify(settings)} />
      {state && "ok" in state && state.ok && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm">Guardado.</p>}
      {state && "error" in state && state.error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm">{state.error}</p>}
      {section === "contenido" ? <ContentFields settings={settings} /> : <GivingFields settings={settings} />}
      <button disabled={pending} className="w-fit rounded-full bg-ink px-6 py-3 text-sm text-white">{pending ? "Guardando…" : "Guardar"}</button>
    </form>
  );
}

function ContentFields({ settings }: { settings: SiteSettings }) {
  return (
    <>
      <Field name="heroTitle" label="Título del inicio" defaultValue={settings.heroTitle} />
      <Field name="heroSubtitle" label="Subtítulo" defaultValue={settings.heroSubtitle} area />
      <Field name="aboutQuote" label="Cita" defaultValue={settings.aboutQuote} area />
      <Field name="aboutText" label="Texto de nosotros" defaultValue={settings.aboutText} area />
      <Field name="history" label="Historia" defaultValue={settings.history} area />
      <Field name="vision" label="Visión" defaultValue={settings.vision} area />
      <div className="grid gap-4 md:grid-cols-2">
        <Field name="sunday" label="Horario domingo" defaultValue={settings.sunday} />
        <Field name="wednesday" label="Horario entre semana" defaultValue={settings.wednesday} />
        <Field name="address" label="Dirección" defaultValue={settings.address} />
        <Field name="city" label="Ciudad" defaultValue={settings.city} />
        <Field name="pastorsLabel" label="Pastores" defaultValue={settings.pastorsLabel} />
        <Field name="pastor" label="Pastor principal" defaultValue={settings.pastor} />
        <Field name="phone" label="Teléfono" defaultValue={settings.phone} />
        <Field name="email" label="Correo" defaultValue={settings.email} />
        <Field name="facebook" label="Facebook" defaultValue={settings.facebook} />
        <Field name="youtube" label="YouTube" defaultValue={settings.youtube} />
        <Field name="mapUrl" label="Enlace de mapa" defaultValue={settings.mapUrl} />
        <Field name="liveYoutubeId" label="ID de YouTube en vivo" defaultValue={settings.liveYoutubeId} />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <label className="text-sm">Color de títulos
          <input name="headingColor" type="color" defaultValue={settings.headingColor || "#1c1b19"} className="mt-1 h-11 w-full rounded-xl border border-line bg-white px-2" />
        </label>
        <label className="text-sm">Color de textos
          <input name="bodyColor" type="color" defaultValue={settings.bodyColor || "#5e5a54"} className="mt-1 h-11 w-full rounded-xl border border-line bg-white px-2" />
        </label>
        <label className="text-sm">Tipografía
          <select name="fontPair" defaultValue={settings.fontPair || "mixed"} className={field}>
            <option value="mixed">Mixta, títulos y texto</option>
            <option value="grotesque">Moderna, toda en sans</option>
            <option value="editorial">Editorial, toda en serif</option>
          </select>
        </label>
      </div>
      {settings.values.map((value, index) => (
        <div key={index} className="grid gap-3 md:grid-cols-2">
          <Field name={`value_title_${index + 1}`} label={`Valor ${index + 1}`} defaultValue={value.title} />
          <Field name={`value_text_${index + 1}`} label="Descripción" defaultValue={value.text} />
        </div>
      ))}
      <HiddenGiving settings={settings} />
    </>
  );
}

function GivingFields({ settings }: { settings: SiteSettings }) {
  return (
    <>
      <HiddenContent settings={settings} />
      <Field name="bankSoles" label="BCP soles" defaultValue={settings.bankSoles} />
      <Field name="bankSolesCci" label="CCI soles" defaultValue={settings.bankSolesCci} />
      <Field name="bankDollars" label="BCP dólares" defaultValue={settings.bankDollars} />
      <Field name="bankDollarsCci" label="CCI dólares" defaultValue={settings.bankDollarsCci} />
      <Field name="yape" label="Yape / Plin" defaultValue={settings.yape} />
      <Field name="cardUrl" label="Enlace Dar con tarjeta" defaultValue={settings.cardUrl} />
    </>
  );
}

function HiddenContent({ settings }: { settings: SiteSettings }) {
  const keys = ["heroTitle","heroSubtitle","aboutQuote","aboutText","history","vision","sunday","wednesday","address","city","pastorsLabel","pastor","phone","email","facebook","youtube","mapUrl","liveYoutubeId","headingColor","bodyColor","fontPair"] as const;
  return (
    <>
      {keys.map((key) => <input key={key} type="hidden" name={key} value={settings[key]} />)}
      {settings.values.map((value, index) => (
        <span key={index}>
          <input type="hidden" name={`value_title_${index + 1}`} value={value.title} />
          <input type="hidden" name={`value_text_${index + 1}`} value={value.text} />
        </span>
      ))}
    </>
  );
}

function HiddenGiving({ settings }: { settings: SiteSettings }) {
  return (
    <>
      {(["bankSoles","bankSolesCci","bankDollars","bankDollarsCci","yape","cardUrl"] as const).map((key) => (
        <input key={key} type="hidden" name={key} value={settings[key]} />
      ))}
    </>
  );
}

function Field({ name, label, defaultValue, area }: { name: string; label: string; defaultValue: string; area?: boolean }) {
  return (
    <label className="text-sm">{label}
      {area ? <textarea name={name} defaultValue={defaultValue} rows={4} className={field} /> : <input name={name} defaultValue={defaultValue} className={field} />}
    </label>
  );
}
