
import { useActionState, useState } from "react";
import { saveSettings } from "@/lib/actions";
import { WEEKDAYS } from "@/lib/next-service";
import type { SiteSettings } from "@/lib/types";

const field = "mt-1 w-full rounded-xl border border-line bg-white px-3 py-2";

const VALUE_SLOTS = 6;

export function SettingsForm({ settings, section }: { settings: SiteSettings; section: "contenido" | "generosidad" }) {
  const [state, action, pending] = useActionState(async (_: unknown, formData: FormData) => saveSettings(formData), undefined);
  return (
    <form action={action} className="grid max-w-3xl gap-4">
      {state && "ok" in state && state.ok && <p className="rounded-xl bg-sage px-3 py-2 text-sm">Guardado.</p>}
      {state && "error" in state && state.error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm">{state.error}</p>}
      {section === "contenido" ? <ContentFields settings={settings} /> : <GivingFields settings={settings} />}
      <button disabled={pending} className="w-fit rounded-full bg-accent px-6 py-3 text-sm text-white">{pending ? "Guardando…" : "Guardar"}</button>
    </form>
  );
}

function Block({ title, note, children }: { title: string; note?: React.ReactNode; children: React.ReactNode }) {
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
  const values = Array.from({ length: VALUE_SLOTS }, (_, index) => settings.values[index] ?? { title: "", text: "" });
  return (
    <>
      <p className="rounded-xl border border-line bg-white px-4 py-3 text-sm leading-6 text-muted">
        Etiquetas pequeñas, botones, menú, pie de página y textos de formularios se editan en{" "}
        <a href="/admin/textos" className="font-semibold text-ink underline-offset-4 hover:underline">Textos por página →</a>
      </p>

      <Block title="Inicio" note="Lo primero que se lee al abrir la web.">
        <Field name="heroTitle" label="Portada · titular" defaultValue={settings.heroTitle} />
        <Field name="heroSubtitle" label="Portada · subtítulo" defaultValue={settings.heroSubtitle} area />
        <div className="grid gap-4 md:grid-cols-2">
          <Field name="visitCta" label="Botón de visita" defaultValue={settings.visitCta} hint="Se usa en la portada, el menú y el pie." />
          <Field name="baptismCta" label="Botón de bautismo" defaultValue={settings.baptismCta} />
        </div>
        <Field name="essenceTitle" label="Nuestra esencia · título" defaultValue={settings.essenceTitle} />
        <Field name="essenceText" label="Nuestra esencia · texto" defaultValue={settings.essenceText} area hint="Deja una línea en blanco para separar párrafos." />
        <Field name="cellsTitle" label="La vida en casas · título" defaultValue={settings.cellsTitle} />
        <Field name="cellsText" label="La vida en casas · texto" defaultValue={settings.cellsText} area hint="Deja una línea en blanco para separar párrafos." />
        <Field name="cellsCta" label="La vida en casas · enlace" defaultValue={settings.cellsCta} />
        <Field name="generationsTitle" label="Redes y ministerios · título" defaultValue={settings.generationsTitle} />
        <Field name="resourcesTitle" label="Recursos · título" defaultValue={settings.resourcesTitle} />
        <Field name="resourcesText" label="Recursos · texto" defaultValue={settings.resourcesText} area />
        <Field name="visitInviteTitle" label="Planifica tu visita · título" defaultValue={settings.visitInviteTitle} />
        <Field name="visitInviteText" label="Planifica tu visita · texto" defaultValue={settings.visitInviteText} area />
      </Block>

      <Block title="Casa, horarios y contacto" note="Estos datos se repiten en el inicio, el pie y Contacto.">
        <div className="grid gap-4 md:grid-cols-2">
          <Field name="sunday" label="Horario del culto principal" defaultValue={settings.sunday} hint="Ejemplo: Domingo 10:00 a. m." />
          <Field name="wednesday" label="Horario entre semana" defaultValue={settings.wednesday} hint="Ejemplo: Miércoles 7:30 p. m." />
          <DaySelect name="serviceDayMain" label="Día del culto principal (cuenta regresiva)" value={settings.serviceDayMain} fallback="0" />
          <DaySelect name="serviceDayWeek" label="Día del culto entre semana (cuenta regresiva)" value={settings.serviceDayWeek} fallback="3" />
          <Field name="address" label="Dirección" defaultValue={settings.address} />
          <Field name="city" label="Ciudad" defaultValue={settings.city} />
          <Field name="pastorsLabel" label="Pastores" defaultValue={settings.pastorsLabel} />
          <Field name="phone" label="Teléfono" defaultValue={settings.phone} />
          <Field name="whatsapp" label="WhatsApp" defaultValue={settings.whatsapp} hint="Solo el número, por ejemplo 987654321. Si lo dejas vacío no se muestra." />
          <Field name="email" label="Correo" defaultValue={settings.email} />
          <Field name="mapUrl" label="Enlace de mapa" defaultValue={settings.mapUrl} />
        </div>
        <Field name="footerTagline" label="Frase del pie de página" defaultValue={settings.footerTagline} area />
      </Block>

      <Block title="Redes, En vivo y Messenger" note="Los enlaces deben empezar con https://. Una red vacía no se muestra en la web.">
        <div className="grid gap-4 md:grid-cols-2">
          <Field name="facebook" label="Facebook" defaultValue={settings.facebook} />
          <Field name="youtube" label="Canal de YouTube" defaultValue={settings.youtube} />
          <Field name="instagram" label="Instagram" defaultValue={settings.instagram} />
          <Field name="tiktok" label="TikTok" defaultValue={settings.tiktok} />
          <Field name="messengerUrl" label="Enlace de Messenger" defaultValue={settings.messengerUrl} hint="Botón flotante y enlaces «Escríbenos». Vacío: se ocultan." />
          <Field name="liveUrl" label="Enlace del botón En vivo" defaultValue={settings.liveUrl} hint="Si lo dejas vacío, el botón abre el canal de YouTube." />
        </div>
        <Field name="liveYoutubeId" label="Enlace o ID de YouTube en vivo" defaultValue={settings.liveYoutubeId} hint="Pega el enlace del video o transmisión; se muestra arriba en Prédicas." />
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
        <p className="text-sm text-muted">Valores (hasta {VALUE_SLOTS}). Deja un nombre vacío para quitar ese valor.</p>
        {values.map((value, index) => (
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
        <Field name="baptismVideo" label="Video del pastor sobre el bautismo (YouTube)" defaultValue={settings.baptismVideo ? `https://youtu.be/${settings.baptismVideo}` : ""} hint="Pega el enlace de YouTube (idealmente menos de 5 minutos). También puedes subir el video en Imágenes y videos → Bautismos. Si no hay video, la sección no se muestra." />
        <div className="grid gap-4 md:grid-cols-2">
          <Field name="baptismVideoTitle" label="Título del video" defaultValue={settings.baptismVideoTitle} />
          <Field name="baptismVideoText" label="Texto junto al video" defaultValue={settings.baptismVideoText} />
        </div>
      </Block>

      <Block title="Visita, oración y prédicas" note="Los motivos de oración se editan en Textos por página.">
        <Field name="visitTitle" label="Título de visita" defaultValue={settings.visitTitle} />
        <Field name="visitText" label="Texto de visita" defaultValue={settings.visitText} area />
        <Field name="contactTitle" label="Título de contacto" defaultValue={settings.contactTitle} />
        <Field name="prayerTitle" label="Título de oración" defaultValue={settings.prayerTitle} />
        <Field name="sermonsTitle" label="Título de prédicas" defaultValue={settings.sermonsTitle} />
        <Field name="sermonsEmpty" label="Texto si no hay transmisión" defaultValue={settings.sermonsEmpty} />
      </Block>

      <Block title="Generosidad, textos" note="Las cuentas bancarias, el QR y el enlace de tarjeta se editan en la pestaña Generosidad.">
        <Field name="giveTitle" label="Título" defaultValue={settings.giveTitle} />
        <Field name="giveLead" label="Frase corta" defaultValue={settings.giveLead} />
        <Field name="giveBody" label="Texto" defaultValue={settings.giveBody} area />
        <Field name="giveYapeText" label="Texto de Yape / Plin" defaultValue={settings.giveYapeText} />
        <Field name="giveCardText" label="Texto de tarjeta" defaultValue={settings.giveCardText} hint="Se muestra solo si hay un enlace «Dar con tarjeta» en Generosidad." />
        <Field name="giveAbroadText" label="Texto para transferencias desde el extranjero" defaultValue={settings.giveAbroadText} area hint="El código SWIFT y las cuentas se editan en la pestaña Generosidad." />
      </Block>

    </>
  );
}

function GivingFields({ settings }: { settings: SiteSettings }) {
  const [preview, setPreview] = useState(settings.yapeQr);
  return (
    <>
      <Field name="bankSoles" label="BCP soles" defaultValue={settings.bankSoles} />
      <Field name="bankSolesCci" label="CCI soles" defaultValue={settings.bankSolesCci} />
      <Field name="bankDollars" label="BCP dólares" defaultValue={settings.bankDollars} />
      <Field name="bankDollarsCci" label="CCI dólares" defaultValue={settings.bankDollarsCci} />
      <Field name="bankHolder" label="Titular de las cuentas" defaultValue={settings.bankHolder} />
      <Field name="bankSwift" label="Código SWIFT (transferencias desde el extranjero)" defaultValue={settings.bankSwift} hint="BCP: BCPLPEPL. Si lo dejas vacío, la tarjeta «Desde el extranjero» no se muestra." />
      <Field name="yape" label="Yape / Plin" defaultValue={settings.yape} />
      <Field name="yapeHolder" label="Nombre que aparece al yapear" defaultValue={settings.yapeHolder} />
      <div className="grid gap-4 rounded-2xl border border-line bg-white p-4 sm:grid-cols-[8rem_1fr]">
        <div className="grid aspect-square place-items-center overflow-hidden rounded-xl bg-paper">
          {preview ? <img src={preview} alt="QR de Yape actual" className="h-full w-full object-contain" /> : <span className="px-2 text-center text-xs text-muted">Sin QR</span>}
        </div>
        <div className="grid content-start gap-3">
          <label className="text-sm">Subir imagen del QR de Yape
            <input
              name="yapeQrFile"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) setPreview(URL.createObjectURL(file));
              }}
              className="mt-1 block w-full text-sm"
            />
          </label>
          <p className="text-xs leading-5 text-muted">PNG, JPG o WEBP de hasta 4 MB. Si subes una imagen, reemplaza el enlace de abajo.</p>
          <Field name="yapeQr" label="O enlace de la imagen del QR" defaultValue={settings.yapeQr} />
        </div>
      </div>
      <Field name="cardUrl" label="Enlace Dar con tarjeta" defaultValue={settings.cardUrl} hint="Si lo completas, Generosidad muestra una tercera tarjeta con el botón para donar con tarjeta." />
    </>
  );
}

function DaySelect({ name, label, value, fallback }: { name: string; label: string; value?: string; fallback: string }) {
  return (
    <label className="text-sm">{label}
      <select name={name} defaultValue={value || fallback} className={field}>
        {WEEKDAYS.map((day, index) => <option key={day} value={String(index)}>{day}</option>)}
      </select>
    </label>
  );
}

function Field({ name, label, defaultValue, area, hint }: { name: string; label: string; defaultValue?: string; area?: boolean; hint?: string }) {
  return (
    <label className="text-sm">{label}
      {area ? <textarea name={name} defaultValue={defaultValue ?? ""} rows={4} className={field} /> : <input name={name} defaultValue={defaultValue ?? ""} className={field} />}
      {hint ? <span className="mt-1 block text-xs leading-5 text-muted">{hint}</span> : null}
    </label>
  );
}
