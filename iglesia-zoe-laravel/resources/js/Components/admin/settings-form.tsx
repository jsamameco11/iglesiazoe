
import { useActionState } from "react";
import { saveSettings } from "@/lib/actions";
import type { SiteSettings } from "@/lib/types";

const field = "mt-1 w-full rounded-xl border border-line bg-white px-3 py-2";

const copyKeys = [
  "heroTitle","heroSubtitle","aboutQuote","aboutText","history","vision","sunday","wednesday","address","city","pastorsLabel","pastor","phone","whatsapp","email","facebook","youtube","mapUrl","liveYoutubeId","headingColor","bodyColor","accentColor","paperColor","stoneColor","clayColor","fontPair",
  "visitCta","sermonsCta","baptismCta","railTitle","railText","ctaVisitTitle","ctaVisitText","ctaBaptismTitle","ctaBaptismText","ctaPrayerTitle","ctaPrayerText","homeFamilyKicker","homeFamilyTitle","homeMinistriesTitle","footerTagline",
  "aboutKicker","aboutTitle","aboutValuesTitle","aboutValuesText","ministriesTitle","ministriesText",
  "baptismTitle","baptismLead","baptismBody","baptismDateLabel","baptismRequirementLabel","baptismRequirement","baptismDateFallback",
  "visitTitle","visitText","contactTitle","prayerTitle","giveTitle","giveLead","giveBody","giveYapeText","giveCardText","sermonsTitle","sermonsEmpty",
] as const;

export function SettingsForm({ settings, section }: { settings: SiteSettings; section: "contenido" | "generosidad" }) {
  const [state, action, pending] = useActionState(async (_: unknown, formData: FormData) => saveSettings(formData), undefined);
  return (
    <form action={action} className="grid max-w-3xl gap-4">
      <input type="hidden" name="current" value={JSON.stringify(settings)} />
      {state && "ok" in state && state.ok && <p className="rounded-xl bg-sage px-3 py-2 text-sm">Guardado.</p>}
      {state && "error" in state && state.error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm">{state.error}</p>}
      {section === "contenido" ? <ContentFields settings={settings} /> : <GivingFields settings={settings} />}
      <button disabled={pending} className="w-fit rounded-full bg-accent px-6 py-3 text-sm text-white">{pending ? "Guardando…" : "Guardar"}</button>
    </form>
  );
}

function Block({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="mt-4 grid gap-4 border-t border-line pt-8 first:mt-0 first:border-0 first:pt-0">
      <div>
        <h2 className="text-xl font-medium tracking-[-0.03em]">{title}</h2>
        {note ? <p className="mt-1 text-sm leading-6 text-muted">{note}</p> : null}
      </div>
      {children}
    </section>
  );
}

function ContentFields({ settings }: { settings: SiteSettings }) {
  return (
    <>
      <Block title="Inicio" note="Lo primero que se lee al abrir la web.">
        <Field name="heroTitle" label="Título del inicio" defaultValue={settings.heroTitle} />
        <Field name="heroSubtitle" label="Subtítulo" defaultValue={settings.heroSubtitle} area />
        <Field name="railTitle" label="Título de la franja de fotos" defaultValue={settings.railTitle} />
        <Field name="railText" label="Texto de la franja de fotos" defaultValue={settings.railText} area />
        <div className="grid gap-4 md:grid-cols-2">
          <Field name="visitCta" label="Botón de visita" defaultValue={settings.visitCta} />
          <Field name="sermonsCta" label="Botón de prédicas" defaultValue={settings.sermonsCta} />
          <Field name="baptismCta" label="Botón de bautismo" defaultValue={settings.baptismCta} />
        </div>
        <Field name="homeFamilyKicker" label="Etiqueta del bloque familiar" defaultValue={settings.homeFamilyKicker} />
        <Field name="homeFamilyTitle" label="Título del bloque familiar" defaultValue={settings.homeFamilyTitle} />
        <Field name="homeMinistriesTitle" label="Título de ministerios en el inicio" defaultValue={settings.homeMinistriesTitle} />
        <div className="grid gap-4 md:grid-cols-2">
          <Field name="ctaVisitTitle" label="Tarjeta visita, título" defaultValue={settings.ctaVisitTitle} />
          <Field name="ctaVisitText" label="Tarjeta visita, texto" defaultValue={settings.ctaVisitText} />
          <Field name="ctaBaptismTitle" label="Tarjeta bautismo, título" defaultValue={settings.ctaBaptismTitle} />
          <Field name="ctaBaptismText" label="Tarjeta bautismo, texto" defaultValue={settings.ctaBaptismText} />
          <Field name="ctaPrayerTitle" label="Tarjeta oración, título" defaultValue={settings.ctaPrayerTitle} />
          <Field name="ctaPrayerText" label="Tarjeta oración, texto" defaultValue={settings.ctaPrayerText} />
        </div>
      </Block>

      <Block title="Casa, horarios y contacto" note="Estos datos se repiten en el inicio, el pie y Contacto.">
        <div className="grid gap-4 md:grid-cols-2">
          <Field name="sunday" label="Horario domingo" defaultValue={settings.sunday} />
          <Field name="wednesday" label="Horario entre semana" defaultValue={settings.wednesday} />
          <Field name="address" label="Dirección" defaultValue={settings.address} />
          <Field name="city" label="Ciudad" defaultValue={settings.city} />
          <Field name="pastorsLabel" label="Pastores" defaultValue={settings.pastorsLabel} />
          <Field name="pastor" label="Pastor principal" defaultValue={settings.pastor} />
          <Field name="phone" label="Teléfono" defaultValue={settings.phone} />
          <Field name="whatsapp" label="WhatsApp" defaultValue={settings.whatsapp} />
          <Field name="email" label="Correo" defaultValue={settings.email} />
          <Field name="facebook" label="Facebook" defaultValue={settings.facebook} />
          <Field name="youtube" label="YouTube" defaultValue={settings.youtube} />
          <Field name="mapUrl" label="Enlace de mapa" defaultValue={settings.mapUrl} />
          <Field name="liveYoutubeId" label="ID de YouTube en vivo" defaultValue={settings.liveYoutubeId} />
        </div>
        <Field name="footerTagline" label="Frase del pie de página" defaultValue={settings.footerTagline} area />
      </Block>

      <Block title="Conócenos">
        <Field name="aboutKicker" label="Etiqueta" defaultValue={settings.aboutKicker} />
        <Field name="aboutTitle" label="Título" defaultValue={settings.aboutTitle} />
        <Field name="aboutQuote" label="Cita" defaultValue={settings.aboutQuote} area />
        <Field name="aboutText" label="Texto de los pastores" defaultValue={settings.aboutText} area />
        <Field name="history" label="Historia" defaultValue={settings.history} area />
        <Field name="vision" label="Visión" defaultValue={settings.vision} area />
        <Field name="aboutValuesTitle" label="Título de valores" defaultValue={settings.aboutValuesTitle} />
        <Field name="aboutValuesText" label="Texto de valores" defaultValue={settings.aboutValuesText} area />
        {settings.values.map((value, index) => (
          <div key={index} className="grid gap-3 md:grid-cols-2">
            <Field name={`value_title_${index + 1}`} label={`Valor ${index + 1}`} defaultValue={value.title} />
            <Field name={`value_text_${index + 1}`} label="Descripción" defaultValue={value.text} />
          </div>
        ))}
      </Block>

      <Block title="Ministerios" note="Los nombres, edades y textos de cada ministerio se editan en la pestaña Ministerios.">
        <Field name="ministriesTitle" label="Título de la página" defaultValue={settings.ministriesTitle} />
        <Field name="ministriesText" label="Texto de la página" defaultValue={settings.ministriesText} area />
      </Block>

      <Block title="Bautismos" note="La fecha que aparece en la web se publica en la pestaña Bautismos. Aquí se editan los textos de la página.">
        <Field name="baptismTitle" label="Título" defaultValue={settings.baptismTitle} />
        <Field name="baptismLead" label="Frase corta" defaultValue={settings.baptismLead} />
        <Field name="baptismBody" label="Texto" defaultValue={settings.baptismBody} area />
        <div className="grid gap-4 md:grid-cols-2">
          <Field name="baptismDateLabel" label="Etiqueta de la fecha" defaultValue={settings.baptismDateLabel} />
          <Field name="baptismDateFallback" label="Si no hay fecha publicada" defaultValue={settings.baptismDateFallback} />
          <Field name="baptismRequirementLabel" label="Etiqueta del requisito" defaultValue={settings.baptismRequirementLabel} />
          <Field name="baptismRequirement" label="Requisito" defaultValue={settings.baptismRequirement} />
        </div>
      </Block>

      <Block title="Visita, oración y prédicas">
        <Field name="visitTitle" label="Título de visita" defaultValue={settings.visitTitle} />
        <Field name="visitText" label="Texto de visita" defaultValue={settings.visitText} area />
        <Field name="contactTitle" label="Título de contacto" defaultValue={settings.contactTitle} />
        <Field name="prayerTitle" label="Título de oración" defaultValue={settings.prayerTitle} />
        <Field name="sermonsTitle" label="Título de prédicas" defaultValue={settings.sermonsTitle} />
        <Field name="sermonsEmpty" label="Texto si no hay transmisión" defaultValue={settings.sermonsEmpty} />
      </Block>

      <Block title="Generosidad, textos" note="Las cuentas bancarias se editan en la pestaña Generosidad.">
        <Field name="giveTitle" label="Título" defaultValue={settings.giveTitle} />
        <Field name="giveLead" label="Frase corta" defaultValue={settings.giveLead} />
        <Field name="giveBody" label="Texto" defaultValue={settings.giveBody} area />
        <Field name="giveYapeText" label="Texto de Yape / Plin" defaultValue={settings.giveYapeText} />
        <Field name="giveCardText" label="Texto de tarjeta" defaultValue={settings.giveCardText} />
      </Block>

      <Block title="Apariencia" note="Estos colores se usan en toda la web: botones, fondos, tarjetas y franjas. También puedes abrir Diseño de la página para tipografías y formas.">
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
          <label className="text-sm">Acento (naranja ladrillo)
            <input name="accentColor" type="color" defaultValue={settings.accentColor || "#C45C26"} className="mt-1 h-11 w-full rounded-xl border border-line bg-white px-2" />
          </label>
          <label className="text-sm">Títulos (carbón)
            <input name="headingColor" type="color" defaultValue={settings.headingColor || "#2A2623"} className="mt-1 h-11 w-full rounded-xl border border-line bg-white px-2" />
          </label>
          <label className="text-sm">Fondo (marfil)
            <input name="paperColor" type="color" defaultValue={settings.paperColor || "#F7F4EF"} className="mt-1 h-11 w-full rounded-xl border border-line bg-white px-2" />
          </label>
          <label className="text-sm">Textos
            <input name="bodyColor" type="color" defaultValue={settings.bodyColor || "#6F6A64"} className="mt-1 h-11 w-full rounded-xl border border-line bg-white px-2" />
          </label>
          <label className="text-sm">Arena / piedra
            <input name="stoneColor" type="color" defaultValue={settings.stoneColor || "#E4DFD6"} className="mt-1 h-11 w-full rounded-xl border border-line bg-white px-2" />
          </label>
          <label className="text-sm">Terracota suave
            <input name="clayColor" type="color" defaultValue={settings.clayColor || "#E8D0C2"} className="mt-1 h-11 w-full rounded-xl border border-line bg-white px-2" />
          </label>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm">Tipografía
            <select name="fontPair" defaultValue={settings.fontPair || "mixed"} className={field}>
              <option value="mixed">Mixta, títulos y texto</option>
              <option value="grotesque">Moderna, toda en sans</option>
              <option value="editorial">Editorial, toda en serif</option>
            </select>
          </label>
          <a href="/admin/diseno" className="self-end w-fit rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold">Más opciones de diseño →</a>
        </div>
      </Block>
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
      <Field name="bankHolder" label="Titular de las cuentas" defaultValue={settings.bankHolder} />
      <Field name="yape" label="Yape / Plin" defaultValue={settings.yape} />
      <Field name="yapeHolder" label="Nombre que aparece al yapear" defaultValue={settings.yapeHolder} />
      <Field name="yapeQr" label="Imagen del QR de Yape" defaultValue={settings.yapeQr} />
      <Field name="cardUrl" label="Enlace Dar con tarjeta" defaultValue={settings.cardUrl} />
    </>
  );
}

function HiddenContent({ settings }: { settings: SiteSettings }) {
  return (
    <>
      {copyKeys.map((key) => <input key={key} type="hidden" name={key} value={settings[key]} />)}
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
      {(["bankSoles","bankSolesCci","bankDollars","bankDollarsCci","bankHolder","yape","yapeHolder","yapeQr","cardUrl"] as const).map((key) => (
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
