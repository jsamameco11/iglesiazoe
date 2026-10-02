import { usePage } from "@inertiajs/react";
import type { SiteSettings } from "@/lib/types";

type Entry = { readonly key: string; readonly label: string; readonly value: string; readonly area?: boolean; readonly hint?: string };
type Group = { readonly id: string; readonly title: string; readonly note?: string; readonly entries: readonly Entry[] };

export const copyGroups = [
  {
    id: "nav",
    title: "Menú y cabecera",
    note: "Se ven en todas las páginas, arriba y en el menú del celular.",
    entries: [
      { key: "nav.brand", label: "Nombre junto al logo", value: "Iglesia Zoe" },
      { key: "nav.about", label: "Menú · Conócenos", value: "Conócenos" },
      { key: "nav.aboutNote", label: "Menú celular · nota de Conócenos", value: "Historia y pastores" },
      { key: "nav.ministries", label: "Menú · Ministerios", value: "Ministerios" },
      { key: "nav.ministriesNote", label: "Menú celular · nota de Ministerios", value: "Cada generación" },
      { key: "nav.baptism", label: "Menú · Bautismo", value: "Bautismo" },
      { key: "nav.baptismNote", label: "Menú celular · nota de Bautismo", value: "Tu nuevo comienzo" },
      { key: "nav.sermons", label: "Menú · Prédicas", value: "Prédicas" },
      { key: "nav.sermonsNote", label: "Menú celular · nota de Prédicas", value: "Mensajes y series" },
      { key: "nav.prayer", label: "Menú · Oración", value: "Oración" },
      { key: "nav.prayerNote", label: "Menú celular · nota de Oración", value: "Estamos contigo" },
      { key: "nav.give", label: "Menú · Dar", value: "Dar" },
      { key: "nav.giveNote", label: "Menú celular · nota de Dar", value: "Generosidad" },
      { key: "nav.home", label: "Menú celular · enlace al inicio", value: "Inicio" },
      { key: "nav.live", label: "Botón en vivo", value: "En vivo" },
      { key: "nav.access", label: "Enlace al sistema", value: "Acceso al sistema" },
      { key: "nav.dropKicker", label: "Desplegable de ministerios · etiqueta", value: "Crecer" },
      { key: "nav.dropTitle", label: "Desplegable de ministerios · título", value: "Un lugar para cada etapa" },
      { key: "nav.dropAll", label: "Desplegable de ministerios · enlace", value: "Ver todos →" },
      { key: "nav.menuKicker", label: "Menú celular · etiqueta del recuadro", value: "Siguiente paso" },
      { key: "nav.menuTitle", label: "Menú celular · título del recuadro", value: "Te esperamos en casa." },
      { key: "nav.menuText", label: "Menú celular · texto del recuadro", value: "Cuéntanos que vienes y un equipo de bienvenida estará atento.", area: true },
      { key: "nav.fab", label: "Botón flotante de Messenger", value: "Escríbenos" },
    ],
  },
  {
    id: "footer",
    title: "Pie de página",
    entries: [
      { key: "footer.brand", label: "Nombre", value: "iglesia zoe" },
      { key: "footer.colKnow", label: "Columna 1 · título", value: "Conoce" },
      { key: "footer.colNext", label: "Columna 2 · título", value: "Siguiente paso" },
      { key: "footer.colVisit", label: "Columna 3 · título", value: "Visítanos" },
      { key: "footer.give", label: "Enlace a generosidad", value: "Generosidad" },
      { key: "footer.messenger", label: "Enlace a Messenger", value: "Escríbenos por Messenger" },
      { key: "footer.whatsapp", label: "Enlace a WhatsApp", value: "Escríbenos por WhatsApp" },
    ],
  },
  {
    id: "home",
    title: "Inicio",
    note: "Los títulos principales del inicio están en Textos. Aquí van los encabezados de cada bloque.",
    entries: [
      { key: "home.countdownNext", label: "Cuenta regresiva · texto", value: "Siguiente culto" },
      { key: "home.countdownLive", label: "Cuenta regresiva · en vivo", value: "Estamos reunidos" },
      { key: "home.scheduleKicker", label: "Horarios · etiqueta (opción Luz)", value: "Horarios y sede" },
      { key: "home.scheduleTitleCasa", label: "Horarios · título (opción Casa)", value: "Nuestros horarios" },
      { key: "home.scheduleTitleLuz", label: "Horarios · título (opción Luz)", value: "Una casa abierta cada semana." },
      { key: "facts.sunday", label: "Etiqueta del horario principal", value: "Domingo", hint: "También se usa en Conócenos." },
      { key: "facts.week", label: "Etiqueta del horario entre semana", value: "Entre semana", hint: "También se usa en Conócenos." },
      { key: "facts.place", label: "Etiqueta de la sede", value: "Sede", hint: "También se usa en Conócenos." },
      { key: "home.ministriesKicker", label: "Ministerios · etiqueta", value: "Ministerios" },
      { key: "home.ministriesMore", label: "Ministerios · botón", value: "Conoce más" },
      { key: "home.giveCardTitle", label: "Tarjeta generosidad · título (opción Luz)", value: "Generosidad" },
    ],
  },
  {
    id: "about",
    title: "Conócenos",
    entries: [
      { key: "about.pastorsKicker", label: "Pastores · etiqueta", value: "Pastores" },
      { key: "about.historyKicker", label: "Historia · etiqueta", value: "01 · Casa" },
      { key: "about.historyTitle", label: "Historia · título", value: "Nuestra historia" },
      { key: "about.visionKicker", label: "Visión · etiqueta", value: "Visión" },
      { key: "about.valuesKicker", label: "Valores · etiqueta", value: "02 · Cómo vivimos" },
      { key: "about.firstKicker", label: "Primera vez · etiqueta", value: "Bienvenida" },
      { key: "about.firstTitle", label: "Primera vez · título", value: "¿Vienes por primera vez?" },
      { key: "about.firstText", label: "Primera vez · texto", value: "Si es tu primera vez en la iglesia queremos seguir en contacto contigo.", area: true },
      { key: "about.firstCta", label: "Primera vez · frase del botón", value: "Por favor llena este breve formulario." },
      { key: "about.firstPill", label: "Primera vez · botón", value: "Conoce más aquí" },
    ],
  },
  {
    id: "ministries",
    title: "Ministerios",
    entries: [
      { key: "ministries.kicker", label: "Etiqueta de la página", value: "Ministerios" },
      { key: "ministries.back", label: "Enlace para volver (página de cada ministerio)", value: "Ministerios" },
    ],
  },
  {
    id: "visit",
    title: "Planifica tu visita",
    entries: [
      { key: "visit.kicker", label: "Etiqueta de la página", value: "Primera vez" },
      { key: "visit.formKicker", label: "Formulario · etiqueta", value: "Bienvenida" },
      { key: "visit.formTitle", label: "Formulario · título", value: "Deja tus datos y te recibimos." },
      { key: "visit.formText", label: "Formulario · texto", value: "Un equipo de la casa estará atento para acompañarte en tu primera visita.", area: true },
      { key: "visit.contactKicker", label: "Contacto · etiqueta", value: "Visítanos" },
      { key: "visit.contactTitle", label: "Contacto · título", value: "Nuestros datos de contacto" },
      { key: "visit.phoneTitle", label: "Tarjeta teléfono · título", value: "Nuestros teléfonos" },
      { key: "visit.phoneCall", label: "Tarjeta teléfono · llamar", value: "Llámanos" },
      { key: "visit.phoneWrite", label: "Tarjeta teléfono · escribir", value: "Escríbenos" },
      { key: "visit.messenger", label: "Tarjeta teléfono · Messenger", value: "Messenger de la iglesia" },
      { key: "visit.whatsapp", label: "Tarjeta teléfono · WhatsApp", value: "WhatsApp de la iglesia" },
      { key: "visit.addressTitle", label: "Tarjeta dirección · título", value: "Nuestra dirección" },
      { key: "visit.addressSub", label: "Tarjeta dirección · subtítulo", value: "Visítanos" },
      { key: "visit.mailTitle", label: "Tarjeta correo · título", value: "Nuestro correo" },
      { key: "visit.mailSub", label: "Tarjeta correo · subtítulo", value: "Contáctanos" },
      { key: "visit.mailNote", label: "Tarjeta correo · nota", value: "Te respondemos lo antes posible." },
    ],
  },
  {
    id: "baptism",
    title: "Bautismos",
    entries: [
      { key: "baptism.kicker", label: "Etiqueta de la página", value: "Bautismos" },
      { key: "baptism.formKicker", label: "Formulario · etiqueta", value: "Inscripción" },
      { key: "baptism.formTitle", label: "Formulario · título", value: "Da el paso hoy." },
      { key: "baptism.formText", label: "Formulario · texto", value: "Déjanos tus datos y un servidor de la iglesia te acompañará en todo el proceso.", area: true },
      { key: "baptism.galleryKicker", label: "Galería · etiqueta", value: "Galería" },
      { key: "baptism.galleryTitle", label: "Galería · título", value: "Vidas que dieron el paso" },
      { key: "baptism.galleryCaption", label: "Galería · frase final", value: "Cada bautismo es una historia de fe que comienza de nuevo." },
    ],
  },
  {
    id: "sermons",
    title: "Prédicas",
    entries: [
      { key: "sermons.kicker", label: "Etiqueta de la página", value: "Prédicas" },
      { key: "sermons.overlay", label: "Etiqueta sobre la foto (opción Casa)", value: "Domingo" },
      { key: "sermons.library", label: "Biblioteca · título", value: "Biblioteca" },
      { key: "sermons.libraryEmpty", label: "Biblioteca · texto si está vacía", value: "Los mensajes anteriores aparecerán aquí, organizados por serie.", area: true },
      { key: "sermons.defaultSeries", label: "Nombre para prédicas sin serie", value: "Mensajes" },
    ],
  },
  {
    id: "give",
    title: "Generosidad",
    note: "Los números de cuenta y el QR se editan en la pestaña Generosidad.",
    entries: [
      { key: "give.kicker", label: "Etiqueta de la página", value: "Generosidad" },
      { key: "give.transferTitle", label: "Transferencia · título", value: "Transferencia" },
      { key: "give.bank", label: "Transferencia · banco", value: "Banco BCP" },
      { key: "give.soles", label: "Etiqueta · cuenta soles", value: "Cuenta soles" },
      { key: "give.solesCci", label: "Etiqueta · CCI soles", value: "CCI soles" },
      { key: "give.dollars", label: "Etiqueta · cuenta dólares", value: "Cuenta dólares" },
      { key: "give.dollarsCci", label: "Etiqueta · CCI dólares", value: "CCI dólares" },
      { key: "give.holder", label: "Texto antes del titular", value: "A nombre de" },
      { key: "give.empty", label: "Texto si no hay cuentas", value: "Las cuentas se publican cuando el administrador las registra." },
      { key: "give.yapeTitle", label: "Yape · título", value: "Yape / Plin" },
      { key: "give.qrCaption", label: "Yape · texto bajo el QR", value: "Escanea con Yape o Plin" },
      { key: "give.cardTitle", label: "Tarjeta · título", value: "Con tarjeta" },
      { key: "give.cardButton", label: "Tarjeta · botón", value: "Dar con tarjeta" },
    ],
  },
  {
    id: "contact",
    title: "Contacto y oración",
    entries: [
      { key: "contact.kicker", label: "Etiqueta de la página", value: "Oración" },
      { key: "contact.messenger", label: "Enlace a Messenger", value: "Messenger" },
      { key: "contact.whatsapp", label: "Enlace a WhatsApp", value: "WhatsApp" },
      { key: "contact.map", label: "Enlace al mapa", value: "Cómo llegar" },
      { key: "prayer.kicker", label: "Panel de oración · etiqueta", value: "Oramos contigo" },
      { key: "prayer.title", label: "Panel de oración · título", value: "No tienes que *cargarlo solo.*", hint: "Lo que escribas entre asteriscos se ve en cursiva." },
      {
        key: "prayer.verses",
        label: "Panel de oración · versículos",
        value:
          "Por nada estéis afanosos, sino sean conocidas vuestras peticiones delante de Dios. | Filipenses 4:6\nClama a mí, y yo te responderé, y te enseñaré cosas grandes y ocultas que tú no conoces. | Jeremías 33:3\nPedid, y se os dará; buscad, y hallaréis; llamad, y se os abrirá. | Mateo 7:7\nEchando toda vuestra ansiedad sobre él, porque él tiene cuidado de vosotros. | 1 Pedro 5:7\nCercano está Jehová a todos los que le invocan, a todos los que le invocan de veras. | Salmos 145:18\nOrad unos por otros… La oración eficaz del justo puede mucho. | Santiago 5:16",
        area: true,
        hint: "Un versículo por línea: texto | cita.",
      },
      { key: "prayer.step1Title", label: "Paso 1 · título", value: "Escribe tu petición" },
      { key: "prayer.step1Text", label: "Paso 1 · texto", value: "Cuéntanos el motivo con la confianza de que será tratado con respeto." },
      { key: "prayer.step2Title", label: "Paso 2 · título", value: "Oramos por ti" },
      { key: "prayer.step2Text", label: "Paso 2 · texto", value: "Nuestro equipo de intercesión presenta cada petición delante de Dios durante la semana." },
      { key: "prayer.step3Title", label: "Paso 3 · título", value: "Te acompañamos" },
      { key: "prayer.step3Text", label: "Paso 3 · texto", value: "Si nos dejas tu teléfono, un servidor de la casa puede escribirte." },
      { key: "contact.formKicker", label: "Formulario · etiqueta", value: "Escríbenos" },
      { key: "contact.formText", label: "Formulario · texto", value: "Elige el motivo y cuéntanos tu petición. Oraremos por ti con cariño y discreción.", area: true },
      { key: "prayer.privacy", label: "Formulario · nota de privacidad", value: "Tu petición es confidencial: solo la recibe el equipo pastoral y de intercesión." },
      { key: "prayer.thanks", label: "Mensaje al enviar", value: "Recibimos tu petición. Nuestro equipo de intercesión estará orando por ti esta semana.", area: true },
      { key: "prayer.thanksVerse", label: "Versículo al enviar", value: "«La oración eficaz del justo puede mucho.» Santiago 5:16" },
      { key: "contact.visitKicker", label: "Invitación final · etiqueta", value: "¿Quieres conocernos en persona?" },
      { key: "contact.visitTitle", label: "Invitación final · título", value: "Planifica tu visita" },
      { key: "contact.visitText", label: "Invitación final · texto", value: "Déjanos tus datos y un equipo de la casa te recibirá en tu primera visita.", area: true },
    ],
  },
  {
    id: "forms",
    title: "Formularios",
    note: "Los campos de los formularios de visita, bautismo y oración.",
    entries: [
      { key: "forms.firstName", label: "Campo · nombres", value: "Nombres" },
      { key: "forms.lastName", label: "Campo · apellidos", value: "Apellidos" },
      { key: "forms.sex", label: "Campo · sexo", value: "Sexo" },
      { key: "forms.age", label: "Campo · edad", value: "Edad" },
      { key: "forms.agePlaceholder", label: "Campo · edad (texto de ayuda)", value: "Años" },
      { key: "forms.marital", label: "Campo · estado civil", value: "Estado civil" },
      { key: "forms.country", label: "Campo · país", value: "País" },
      { key: "forms.phone", label: "Campo · teléfono", value: "Teléfono" },
      { key: "forms.phonePlaceholder", label: "Campo · teléfono (texto de ayuda)", value: "Número" },
      { key: "forms.email", label: "Campo · correo", value: "Correo electrónico" },
      { key: "forms.optional", label: "Marca de campo opcional", value: "(opcional)" },
      { key: "forms.sending", label: "Botón mientras se envía", value: "Enviando…" },
      { key: "visit.service", label: "Visita · campo del servicio", value: "Servicio al que asistirás" },
      { key: "visit.thanks", label: "Visita · mensaje al enviar", value: "¡Gracias! Recibimos tus datos y te esperamos con los brazos abiertos.", area: true },
      { key: "baptism.date", label: "Bautismo · campo de la fecha", value: "Fecha del bautismo" },
      { key: "baptism.story", label: "Bautismo · campo de la decisión", value: "Cuéntanos tu decisión" },
      { key: "baptism.thanks", label: "Bautismo · mensaje al enviar", value: "¡Gloria a Dios! Recibimos tu inscripción y pronto te contactaremos.", area: true },
      { key: "prayer.topicLabel", label: "Oración · pregunta del motivo", value: "¿Por qué motivo oramos?" },
      { key: "prayer.name", label: "Oración · campo nombre", value: "Nombre" },
      { key: "prayer.namePlaceholder", label: "Oración · nombre (texto de ayuda)", value: "¿Cómo te llamas?" },
      { key: "prayer.phone", label: "Oración · campo teléfono", value: "Teléfono" },
      { key: "prayer.email", label: "Oración · campo correo", value: "Correo" },
      { key: "prayer.optionalPlaceholder", label: "Oración · texto de ayuda de campos opcionales", value: "Opcional" },
      { key: "prayer.request", label: "Oración · campo de la petición", value: "Tu petición" },
      { key: "prayer.requestPlaceholder", label: "Oración · petición (texto de ayuda)", value: "Cuéntanos por quién o por qué situación quieres que oremos.", area: true },
      { key: "prayer.submit", label: "Oración · botón", value: "Enviar mi petición" },
      { key: "prayer.thanksHello", label: "Oración · saludo al enviar", value: "Gracias, {nombre}.", hint: "{nombre} se reemplaza por el primer nombre de la persona." },
      { key: "prayer.again", label: "Oración · botón para enviar otra", value: "Enviar otra petición" },
    ],
  },
  {
    id: "acceso",
    title: "Acceso al sistema",
    note: "La pantalla /acceso donde ingresan los servidores. El aviso emergente se edita en Indicaciones de la semana.",
    entries: [
      { key: "acceso.brand", label: "Nombre grande", value: "Zoe" },
      { key: "acceso.kicker", label: "Etiqueta", value: "Control de grupos CEREAL" },
      { key: "acceso.title", label: "Título", value: "Acceso al sistema" },
      { key: "acceso.text", label: "Texto", value: "Ingresa para enviar el informe semanal de tu grupo celular.", area: true },
      { key: "acceso.user", label: "Campo usuario", value: "Usuario" },
      { key: "acceso.password", label: "Campo clave", value: "Clave" },
      { key: "acceso.button", label: "Botón", value: "Ingresar" },
      { key: "acceso.back", label: "Enlace para volver", value: "Volver al inicio" },
      {
        key: "acceso.lines",
        label: "Frases de la ilustración",
        value: "Juan 1:1 | En el principio era el Verbo\nCEREAL | Informe de tu grupo\nSalmo 119:105 | Lámpara es a mis pies tu palabra",
        area: true,
        hint: "Una frase por línea: etiqueta | frase. Se escriben solas en la pantalla de la computadora.",
      },
    ],
  },
  {
    id: "panel",
    title: "Ingreso de administración",
    note: "La pantalla de admi-iglesiazoe donde ingresan los administradores y el superadministrador.",
    entries: [
      { key: "panel.kicker", label: "Etiqueta", value: "Iglesia Cristiana Zoe" },
      { key: "panel.title", label: "Título", value: "Panel de administración" },
      { key: "panel.text", label: "Texto", value: "Gestiona la página web, los informes de las células, los temas, las finanzas y el equipo desde un solo lugar.", area: true },
      { key: "panel.points", label: "Puntos destacados", value: "Página web, textos, imágenes y videos\nInformes y ofrendas de cada célula\nTemas de célula para cada semana\nEquipo, accesos y finanzas", area: true, hint: "Un punto por línea." },
      { key: "panel.choose", label: "Selector · pregunta", value: "¿Cómo ingresas?" },
      { key: "panel.admin", label: "Opción · Administrador", value: "Administrador" },
      { key: "panel.adminNote", label: "Opción · nota de Administrador", value: "Visuales, temas, atmósfera y más" },
      { key: "panel.super", label: "Opción · Superadministrador", value: "Superadministrador" },
      { key: "panel.superNote", label: "Opción · nota de Superadministrador", value: "Acceso total y equipo" },
      { key: "panel.user", label: "Campo usuario", value: "Usuario" },
      { key: "panel.password", label: "Campo clave", value: "Clave" },
      { key: "panel.button", label: "Botón", value: "Ingresar al panel" },
      { key: "panel.serverLink", label: "Enlace para servidores", value: "¿Eres servidor de célula o de red? Ingresa desde la web de la iglesia" },
    ],
  },
] as const satisfies readonly Group[];

export type CopyKey = (typeof copyGroups)[number]["entries"][number]["key"];

const defaults = Object.fromEntries(copyGroups.flatMap((group) => group.entries.map((entry) => [entry.key, entry.value]))) as Record<CopyKey, string>;

export function copyDefault(key: CopyKey) {
  return defaults[key];
}

export function readCopy(settings: Pick<SiteSettings, "copy"> | undefined, key: CopyKey) {
  const value = settings?.copy?.[key];
  return typeof value === "string" && value.trim() ? value : defaults[key];
}

export function readPairs(settings: Pick<SiteSettings, "copy"> | undefined, key: CopyKey) {
  return readCopy(settings, key)
    .split(/\r?\n/)
    .map((line) => {
      const [text, ref = ""] = line.split("|");
      return { text: text.trim(), ref: ref.trim() };
    })
    .filter((pair) => pair.text);
}

export function splitEmphasis(text: string) {
  return text.split(/\*([^*]+)\*/).map((part, index) => ({ text: part, em: index % 2 === 1 })).filter((part) => part.text);
}

export function useCopy() {
  const { settings } = usePage().props as unknown as { settings?: SiteSettings };
  return (key: CopyKey) => readCopy(settings, key);
}
