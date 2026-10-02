export type MediaKind = "image" | "video";

export type MediaFit = "fill" | "fit" | "natural";

export type MediaAsset = {
  kind: MediaKind;
  src: string;
  poster: string;
  alt: string;
  ratio?: string;
  fit?: MediaFit;
  posX?: number;
  posY?: number;
  zoom?: number;
  radius?: number;
  feather?: number;
};

export type MediaSlotMeta = {
  id: string;
  group: string;
  label: string;
  hint: string;
};

export type ResolvedMedia = {
  hero: MediaAsset;
  homeCells: MediaAsset;
  aboutPastors: MediaAsset;
  aboutGallery: MediaAsset[];
  visit: MediaAsset;
  sermons: MediaAsset;
  baptismGallery: MediaAsset[];
  giving: MediaAsset;
  contact: MediaAsset;
  baptismVideo: MediaAsset;
  events: MediaAsset;
  teachings: MediaAsset;
  gallery: MediaAsset;
  devotionals: MediaAsset;
  serveCover: MediaAsset;
  routeCover: MediaAsset;
  route: (slot: number) => MediaAsset;
  ministry: (slug: string, name: string) => MediaAsset;
  ministryGallery: (slug: string, name: string) => MediaAsset[];
};

export function clampFocus(value: unknown, fallback = 50) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(100, Math.max(0, Math.round(number)));
}

export function normalizeZoom(value: unknown) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 100;
  return Math.min(220, Math.max(100, Math.round(number)));
}

export function normalizeRadius(value: unknown) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 24;
  return Math.min(80, Math.max(0, Math.round(number)));
}

export function normalizeFeather(value: unknown) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.min(40, Math.max(0, Math.round(number)));
}

export function mediaChromeStyle(asset: Pick<MediaAsset, "radius" | "feather">) {
  const radius = normalizeRadius(asset.radius);
  const feather = normalizeFeather(asset.feather);
  const style: { borderRadius: string; overflow: "hidden"; WebkitMaskImage?: string; maskImage?: string; WebkitMaskComposite?: string; maskComposite?: "intersect" } = {
    borderRadius: `${radius}px`,
    overflow: "hidden",
  };
  if (feather > 0) {
    const fade = Math.max(6, feather);
    const mask = `linear-gradient(to right, transparent 0, #000 ${fade}%, #000 ${100 - fade}%, transparent 100%), linear-gradient(to bottom, transparent 0, #000 ${fade}%, #000 ${100 - fade}%, transparent 100%)`;
    style.WebkitMaskImage = mask;
    style.maskImage = mask;
    style.WebkitMaskComposite = "source-in";
    style.maskComposite = "intersect";
  }
  return style;
}

export function mediaFocusStyle(asset: Pick<MediaAsset, "posX" | "posY" | "zoom">) {
  const x = clampFocus(asset.posX);
  const y = clampFocus(asset.posY);
  const zoom = normalizeZoom(asset.zoom);
  return {
    objectPosition: `${x}% ${y}%`,
    transform: zoom === 100 ? undefined : `scale(${zoom / 100})`,
    transformOrigin: `${x}% ${y}%`,
  };
}

export const fitPresets: { id: MediaFit; label: string; hint: string }[] = [
  { id: "fill", label: "Llenar el recuadro", hint: "La foto cubre todo, sin bordes. Es el valor por defecto." },
  { id: "fit", label: "Ver completa", hint: "Se ve toda la foto. Puede dejar un borde si no coincide el recuadro." },
  { id: "natural", label: "Tamaño original", hint: "El recuadro se adapta al ancho o al alto de la foto." },
];

export function normalizeFit(value?: string): MediaFit {
  if (value === "fit" || value === "contain") return "fit";
  if (value === "natural") return "natural";
  return "fill";
}

export const ratioPresets = [
  { id: "natural", label: "Original de la foto", hint: "Se ve completa, sin recortar." },
  { id: "16/10", label: "16 : 10", hint: "Ancha, para portadas." },
  { id: "16/9", label: "16 : 9", hint: "Formato de video." },
  { id: "4/3", label: "4 : 3", hint: "Clásica, más baja." },
  { id: "3/2", label: "3 : 2", hint: "Fotografía." },
  { id: "1/1", label: "1 : 1", hint: "Cuadrada." },
  { id: "4/5", label: "4 : 5", hint: "Vertical suave." },
  { id: "3/4", label: "3 : 4", hint: "Vertical." },
  { id: "custom", label: "Personalizada", hint: "Tú eliges ancho y alto." },
] as const;

export function parseRatio(value?: string) {
  const raw = String(value || "natural").trim();
  if (!raw || raw === "natural") return { preset: "natural", width: 4, height: 5, css: "" };
  const known = ratioPresets.find((item) => item.id === raw);
  if (known && known.id !== "custom" && known.id !== "natural") {
    const [width, height] = raw.split("/").map(Number);
    return { preset: raw, width, height, css: `${width} / ${height}` };
  }
  const match = raw.match(/^(\d{1,2})\s*[:/]\s*(\d{1,2})$/);
  if (match) {
    const width = Math.min(32, Math.max(1, Number(match[1])));
    const height = Math.min(32, Math.max(1, Number(match[2])));
    const id = `${width}/${height}`;
    const preset = ratioPresets.some((item) => item.id === id) ? id : "custom";
    return { preset, width, height, css: `${width} / ${height}` };
  }
  return { preset: "natural", width: 4, height: 5, css: "" };
}

export function videoMime(src: string) {
  return src.toLowerCase().split("?")[0].endsWith(".webm") ? "video/webm" : "video/mp4";
}

const BAPTISM_PHOTOS = 8;
const ABOUT_PHOTOS = 8;
export const MINISTRY_PHOTOS = 6;
const MINISTRY_DEFAULT_PHOTOS = 4;
export const ROUTE_SLOTS = 6;

function image(src: string, alt: string, extra: Partial<MediaAsset> = {}): MediaAsset {
  return { kind: "image", src, poster: "", alt, ...extra };
}

function baptismSlotId(photo: number) {
  return photo <= 1 ? "baptism" : `baptism-${photo}`;
}

function aboutSlotId(photo: number) {
  return `about-${photo}`;
}

function ministrySlotId(slug: string, photo = 1) {
  return photo <= 1 ? `ministry:${slug}` : `ministry:${slug}:${photo}`;
}

const baptismPool = ["/images/banner8.jpg", "/images/familia1.jpg", "/images/banner4.jpg", "/images/man1.jpg", "/images/pastores.jpg", "/images/man2.jpg"];
const aboutPool = ["/images/banner4.jpg", "/images/familia1.jpg", "/images/banner8.jpg"];
const routePool = ["/images/familia1.jpg", "/images/banner4.jpg", "/images/man2.jpg", "/images/banner8.jpg", "/images/man1.jpg", "/images/pastores.jpg"];

const fixedDefaults: Record<string, MediaAsset> = {
  hero: { kind: "video", src: "/videos/siguientepaso.mp4", poster: "/images/banner8.jpg", alt: "Iglesia Cristiana Zoe" },
  "home-cells": image("/images/vida-en-casas.jpg", "Hermanas de Zoe conversando juntas"),
  "about-pastors": image("/images/pastores.jpg", "Pastores de Iglesia Cristiana Zoe", { ratio: "16/10", fit: "fill", radius: 28, feather: 0 }),
  visit: image("/images/familia1.jpg", "Familia de la iglesia"),
  sermons: image("/images/banner4.jpg", "Culto de Iglesia Cristiana Zoe"),
  giving: image("/images/banner4.jpg", "Generosidad en Iglesia Cristiana Zoe"),
  contact: image("/images/familia1.jpg", "Comunidad de Iglesia Cristiana Zoe"),
  "baptism-video": { kind: "video", src: "", poster: "", alt: "¿Qué es el bautismo?" },
  events: image("/images/banner8.jpg", "Encuentro de Iglesia Cristiana Zoe"),
  teachings: image("/images/banner4.jpg", "Enseñanza en Iglesia Cristiana Zoe"),
  gallery: image("/images/banner8.jpg", "Culto de Iglesia Cristiana Zoe"),
  devotionals: image("/images/vida-en-casas.jpg", "Hermanas de Zoe compartiendo la Palabra"),
  "serve-cover": image("/images/banner4.jpg", "Equipo de servicio de Iglesia Cristiana Zoe"),
  "route-cover": image("/images/familia1.jpg", "Grupo celular de Iglesia Cristiana Zoe"),
  ...Object.fromEntries(Array.from({ length: ROUTE_SLOTS }, (_, index) => [`route-${index + 1}`, image(routePool[index] ?? "", `Ruta del servidor · nivel ${index + 1}`)])),
  ...Object.fromEntries(
    Array.from({ length: BAPTISM_PHOTOS }, (_, index) => [
      baptismSlotId(index + 1),
      image(baptismPool[index] ?? "", `Bautismo en Iglesia Cristiana Zoe · foto ${index + 1}`),
    ]),
  ),
  ...Object.fromEntries(
    Array.from({ length: ABOUT_PHOTOS }, (_, index) => [aboutSlotId(index + 1), image(aboutPool[index] ?? "", `Iglesia Cristiana Zoe · foto ${index + 1}`)]),
  ),
};

const fixedCatalog: MediaSlotMeta[] = [
  { id: "hero", group: "Inicio", label: "Portada principal", hint: "Pantalla completa al abrir el inicio. Puede ser un video o una foto con luz natural y cálida." },
  { id: "home-cells", group: "Inicio", label: "La vida en casas", hint: "Acompaña el bloque «Nadie camina solo en Zoe». Ideal: un grupo pequeño compartiendo en una sala." },
  { id: "about-pastors", group: "Conócenos", label: "Pastores", hint: "Retrato que acompaña la presentación de los pastores." },
  ...Array.from({ length: ABOUT_PHOTOS }, (_, index) => ({
    id: aboutSlotId(index + 1),
    group: "Conócenos",
    label: `Fondo de pantalla · Foto ${index + 1}`,
    hint: "Fondo a pantalla completa de Conócenos; cambia cada 4 segundos. Usa fotos horizontales de buena resolución (mín. 1920 px de ancho).",
  })),
  { id: "visit", group: "Planifica tu visita", label: "Bienvenida", hint: "Imagen o video junto al formulario de primera visita." },
  { id: "sermons", group: "Prédicas", label: "Portada", hint: "Se muestra cuando todavía no hay una transmisión de YouTube." },
  ...Array.from({ length: BAPTISM_PHOTOS }, (_, index) => ({
    id: baptismSlotId(index + 1),
    group: "Bautismos",
    label: `Carrusel · Foto ${index + 1}`,
    hint: "Galería «Vidas que dieron el paso» de la página de bautismo. Todas se muestran del mismo tamaño (vertical 4:5); usa el encuadre para centrar a la persona.",
  })),
  {
    id: "baptism-video",
    group: "Bautismos",
    label: "Video «¿Qué es el bautismo?»",
    hint: "Sube aquí el video del pastor (MP4, menos de 5 minutos). Si prefieres YouTube, pega el enlace en Textos principales → Bautismos; YouTube tiene prioridad.",
  },
  { id: "giving", group: "Generosidad", label: "Dar", hint: "Imagen o video de la página de generosidad." },
  { id: "contact", group: "Contacto y oración", label: "Acompañamiento", hint: "Imagen o video de la página de contacto." },
  { id: "events", group: "Eventos", label: "Portada", hint: "Se muestra en Eventos cuando el próximo evento no tiene imagen." },
  { id: "teachings", group: "Recursos", label: "Portada", hint: "Imagen de la página de enseñanzas descargables." },
  { id: "gallery", group: "Recursos", label: "Galería de cultos · portada", hint: "Foto grande de la página Galería de cultos. Las fotos de cada culto se suben en la pestaña Galería de cultos." },
  { id: "devotionals", group: "Recursos", label: "Devocionales · portada", hint: "Imagen de la página de devocionales y de los devocionales que no tienen imagen propia." },
  { id: "serve-cover", group: "Involúcrate", label: "Portada", hint: "Foto grande de la página Involúcrate. Ideal: un equipo sirviendo. La foto de cada área se cambia en Involúcrate · áreas." },
  { id: "route-cover", group: "Ruta del servidor", label: "Portada", hint: "Foto grande de la página Ruta del servidor." },
  ...Array.from({ length: ROUTE_SLOTS }, (_, index) => ({
    id: `route-${index + 1}`,
    group: "Ruta del servidor",
    label: `Nivel ${index + 1}`,
    hint: `Foto del nivel ${index + 1} de la ruta (en el mismo orden de la pestaña Encabezados y Ruta).`,
  })),
];

const ministryPool = ["/images/banner8.jpg", "/images/banner4.jpg", "/images/familia1.jpg", "/images/pastores.jpg"];
const ministryPhotos = new Set(["zoe-kids", "zoe-teens", "zoe-youth", "redes-de-discipulado"]);

function ministryDefaultSrc(slug: string, photo: number) {
  if (photo > MINISTRY_DEFAULT_PHOTOS) return "";
  if (photo === 1 && ministryPhotos.has(slug)) return `/images/ministerio-${slug}.jpg`;
  let hash = 0;
  for (const char of slug) hash = (hash + char.charCodeAt(0)) % ministryPool.length;
  return ministryPool[(hash + photo - 1) % ministryPool.length];
}

function ministryFallback(slug: string, name: string, photo = 1): MediaAsset {
  return image(ministryDefaultSrc(slug, photo), photo <= 1 ? name : `${name} · foto ${photo}`, { ratio: "4/5", fit: "fill", posX: 50, posY: 50, zoom: 100 });
}

export function mediaCatalog(ministries: { slug: string; name: string }[]): MediaSlotMeta[] {
  const ministrySlots = ministries.flatMap((ministry) =>
    Array.from({ length: MINISTRY_PHOTOS }, (_, index) => ({
      id: ministrySlotId(ministry.slug, index + 1),
      group: "Ministerios",
      label: `${ministry.name} · Foto ${index + 1}`,
      hint:
        index === 0
          ? `Foto principal de ${ministry.name}: se ve en el inicio, en el listado y abre la galería de su página.`
          : index < MINISTRY_DEFAULT_PHOTOS
            ? `Foto ${index + 1} de la galería de ${ministry.name}. Las fotos cambian solas cada 5 segundos y se ven en miniatura debajo de la principal.`
            : `Foto ${index + 1} (opcional) de la galería de ${ministry.name}. Solo aparece si la subes.`,
    })),
  );
  const visitIndex = fixedCatalog.findIndex((slot) => slot.id === "visit");
  return [...fixedCatalog.slice(0, visitIndex), ...ministrySlots, ...fixedCatalog.slice(visitIndex)];
}

function normalize(asset: MediaAsset, fallback: MediaAsset): MediaAsset {
  const ratio = parseRatio(asset.ratio || fallback.ratio);
  return {
    kind: asset.kind,
    src: asset.src,
    poster: typeof asset.poster === "string" ? asset.poster : "",
    alt: typeof asset.alt === "string" && asset.alt.trim() ? asset.alt.trim() : fallback.alt,
    ratio: ratio.css ? `${ratio.width}/${ratio.height}` : "natural",
    fit: normalizeFit(asset.fit || fallback.fit),
    posX: clampFocus(asset.posX ?? fallback.posX),
    posY: clampFocus(asset.posY ?? fallback.posY),
    zoom: normalizeZoom(asset.zoom ?? fallback.zoom),
    radius: normalizeRadius(asset.radius ?? fallback.radius),
    feather: normalizeFeather(asset.feather ?? fallback.feather),
  };
}

function resolve(overrides: Record<string, MediaAsset>, id: string, fallback: MediaAsset): MediaAsset {
  const asset = overrides[id];
  return asset ? normalize(asset, fallback) : fallback;
}

export function resolveMedia(overrides: Record<string, MediaAsset>): ResolvedMedia {
  const fixed = (id: string) => resolve(overrides, id, fixedDefaults[id]);
  return {
    hero: fixed("hero"),
    homeCells: fixed("home-cells"),
    aboutPastors: fixed("about-pastors"),
    aboutGallery: Array.from({ length: ABOUT_PHOTOS }, (_, index) => fixed(aboutSlotId(index + 1))),
    visit: fixed("visit"),
    sermons: fixed("sermons"),
    baptismGallery: Array.from({ length: BAPTISM_PHOTOS }, (_, index) => fixed(baptismSlotId(index + 1))),
    giving: fixed("giving"),
    contact: fixed("contact"),
    baptismVideo: fixed("baptism-video"),
    events: fixed("events"),
    teachings: fixed("teachings"),
    gallery: fixed("gallery"),
    devotionals: fixed("devotionals"),
    serveCover: fixed("serve-cover"),
    routeCover: fixed("route-cover"),
    route: (slot) => (fixedDefaults[`route-${slot}`] ? fixed(`route-${slot}`) : image("", "")),
    ministry: (slug, name) => resolve(overrides, ministrySlotId(slug), ministryFallback(slug, name)),
    ministryGallery: (slug, name) =>
      Array.from({ length: MINISTRY_PHOTOS }, (_, index) =>
        resolve(overrides, ministrySlotId(slug, index + 1), ministryFallback(slug, name, index + 1)),
      ),
  };
}

export function fallbackForSlot(id: string, ministries: { slug: string; name: string }[] = []): MediaAsset {
  if (fixedDefaults[id]) return fixedDefaults[id];
  const photo = Number(/^ministry:[a-z0-9-]+:([2-9])$/.exec(id)?.[1] ?? 1);
  const ministry = ministries.find((item) => ministrySlotId(item.slug, photo) === id);
  return ministry ? ministryFallback(ministry.slug, ministry.name, photo) : image("", "");
}
