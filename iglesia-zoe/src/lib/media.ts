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

export function normalizeRatio(preset: string, widthValue?: string, heightValue?: string) {
  if (!preset || preset === "natural") return "natural";
  if (preset === "custom") {
    const width = Math.min(32, Math.max(1, Number(widthValue) || 4));
    const height = Math.min(32, Math.max(1, Number(heightValue) || 5));
    return `${width}/${height}`;
  }
  const parsed = parseRatio(preset);
  return parsed.css ? `${parsed.width}/${parsed.height}` : "natural";
}

export type MediaSlotMeta = {
  id: string;
  group: string;
  label: string;
  hint: string;
};

const IMAGE_LIMIT = 12 * 1024 * 1024;
const VIDEO_LIMIT = 60 * 1024 * 1024;

export const mediaLimits = {
  image: IMAGE_LIMIT,
  video: VIDEO_LIMIT,
};

export const GALLERY_MIN = 6;
export const GALLERY_MAX = 12;

const galleryDefaults: MediaAsset[] = [
  { kind: "image", src: "/images/banner4.jpg", poster: "", alt: "Culto de la congregación" },
  { kind: "image", src: "/images/man1.jpg", poster: "", alt: "Hermano de la iglesia" },
  { kind: "image", src: "/images/familia1.jpg", poster: "", alt: "Familia de Iglesia Cristiana Zoe" },
  { kind: "image", src: "/images/banner8.jpg", poster: "", alt: "Congregación reunida" },
  { kind: "image", src: "/images/man2.jpg", poster: "", alt: "Hermano de la iglesia" },
  { kind: "image", src: "/images/pastores.jpg", poster: "", alt: "Pastores de Iglesia Cristiana Zoe" },
];

export function gallerySlotId(index: number) {
  return `gallery-${index}`;
}

export function galleryIndex(id: string) {
  const match = /^gallery-(\d+)$/.exec(id);
  return match ? Number(match[1]) : 0;
}

export function isGallerySlot(id: string) {
  const index = galleryIndex(id);
  return index >= 1 && index <= GALLERY_MAX;
}

export function listGalleryIndexes(overrides: Record<string, MediaAsset> = {}) {
  let last = GALLERY_MIN;
  for (const key of Object.keys(overrides)) {
    const index = galleryIndex(key);
    if (index > last && index <= GALLERY_MAX) last = index;
  }
  return Array.from({ length: last }, (_, index) => index + 1);
}

export function compactGalleryOverrides(overrides: Record<string, MediaAsset>) {
  const extras = listGalleryIndexes(overrides)
    .filter((index) => index > GALLERY_MIN)
    .map((index) => overrides[gallerySlotId(index)])
    .filter((asset): asset is MediaAsset => Boolean(asset?.src));
  for (let index = GALLERY_MIN + 1; index <= GALLERY_MAX; index += 1) {
    delete overrides[gallerySlotId(index)];
  }
  extras.forEach((asset, offset) => {
    overrides[gallerySlotId(GALLERY_MIN + 1 + offset)] = asset;
  });
  return extras.length;
}

const fixedDefaults: Record<string, MediaAsset> = {
  hero: {
    kind: "video",
    src: "/videos/siguientepaso.mp4",
    poster: "/images/banner8.jpg",
    alt: "Iglesia Cristiana Zoe",
  },
  "gallery-1": galleryDefaults[0],
  "gallery-2": galleryDefaults[1],
  "gallery-3": galleryDefaults[2],
  "gallery-4": galleryDefaults[3],
  "gallery-5": galleryDefaults[4],
  "gallery-6": galleryDefaults[5],
  "marea-family": {
    kind: "image",
    src: "/images/familia1.jpg",
    poster: "",
    alt: "Familia de Iglesia Cristiana Zoe",
  },
  "marea-culto": {
    kind: "image",
    src: "/images/banner4.jpg",
    poster: "",
    alt: "El culto, con toda la congregación",
  },
  "marea-ciudad": {
    kind: "image",
    src: "/images/banner8.jpg",
    poster: "",
    alt: "La ciudad, en el mismo camino",
  },
  "about-pastors": {
    kind: "image",
    src: "/images/pastores.jpg",
    poster: "",
    alt: "Pastores de Iglesia Cristiana Zoe",
    ratio: "16/10",
    fit: "fill",
    radius: 28,
    feather: 0,
  },
  visit: {
    kind: "image",
    src: "/images/familia1.jpg",
    poster: "",
    alt: "Familia de la iglesia",
  },
  sermons: {
    kind: "image",
    src: "/images/banner4.jpg",
    poster: "",
    alt: "Culto de Iglesia Cristiana Zoe",
  },
  baptism: {
    kind: "image",
    src: "/images/banner8.jpg",
    poster: "",
    alt: "Bautismo en Iglesia Cristiana Zoe",
  },
  giving: {
    kind: "image",
    src: "/images/banner4.jpg",
    poster: "",
    alt: "Generosidad en Iglesia Cristiana Zoe",
  },
  contact: {
    kind: "image",
    src: "/images/familia1.jpg",
    poster: "",
    alt: "Comunidad de Iglesia Cristiana Zoe",
  },
};

const ministryFallbacks: Record<string, string> = {
  "zoe-kids": "/images/familia1.jpg",
  "zoe-teens": "/images/banner4.jpg",
  "zoe-young": "/images/man1.jpg",
  "grupos-28": "/images/man2.jpg",
};

const ministryPool = ["/images/familia1.jpg", "/images/banner4.jpg", "/images/man1.jpg", "/images/man2.jpg"];

const fixedCatalog: MediaSlotMeta[] = [
  {
    id: "hero",
    group: "Inicio",
    label: "Portada principal",
    hint: "Pantalla completa al abrir el inicio. Puede ser un video o una foto.",
  },
  {
    id: "marea-family",
    group: "Inicio",
    label: "La casa",
    hint: "Bloque familiar de la opción Luz.",
  },
  {
    id: "marea-culto",
    group: "Inicio",
    label: "El culto",
    hint: "Primera pieza visual de la opción Luz.",
  },
  {
    id: "marea-ciudad",
    group: "Inicio",
    label: "La ciudad",
    hint: "Segunda pieza visual de la opción Luz.",
  },
  {
    id: "about-pastors",
    group: "Conócenos",
    label: "Pastores",
    hint: "Retrato que acompaña la presentación de los pastores.",
  },
  {
    id: "visit",
    group: "Planifica tu visita",
    label: "Bienvenida",
    hint: "Imagen o video junto al formulario de primera visita.",
  },
  {
    id: "sermons",
    group: "Prédicas",
    label: "Portada",
    hint: "Se muestra cuando todavía no hay una transmisión de YouTube.",
  },
  {
    id: "baptism",
    group: "Bautismos",
    label: "Nuevo comienzo",
    hint: "Imagen o video de la página de bautismo.",
  },
  {
    id: "giving",
    group: "Generosidad",
    label: "Dar",
    hint: "Imagen o video de la página de generosidad.",
  },
  {
    id: "contact",
    group: "Contacto y oración",
    label: "Acompañamiento",
    hint: "Imagen o video de la página de contacto.",
  },
  {
    id: "login",
    group: "Ingreso",
    label: "Acceso",
    hint: "Se ve al iniciar sesión en pantallas grandes. Si no subes un archivo, usa la portada del inicio.",
  },
];

export function ministrySlotId(slug: string) {
  return `ministry:${slug}`;
}

export function ministryFallback(slug: string, name: string): MediaAsset {
  const known = ministryFallbacks[slug];
  if (known) return { kind: "image", src: known, poster: "", alt: name, ratio: "4/5", fit: "fill", posX: 50, posY: 28, zoom: 100 };
  let hash = 0;
  for (const char of slug) hash = (hash + char.charCodeAt(0)) % ministryPool.length;
  return { kind: "image", src: ministryPool[hash], poster: "", alt: name, ratio: "4/5", fit: "fill", posX: 50, posY: 28, zoom: 100 };
}

function galleryMeta(index: number): MediaSlotMeta {
  return {
    id: gallerySlotId(index),
    group: "Carrusel del inicio",
    label: `Foto ${index}`,
    hint:
      index <= GALLERY_MIN
        ? "Se ve en el carrusel. Se muestran 5 y al menos una queda fuera, para que la del centro cambie."
        : "Foto extra del carrusel. Puedes editarla o quitarla cuando quieras.",
  };
}

export function mediaCatalog(
  ministries: { slug: string; name: string }[],
  overrides: Record<string, MediaAsset> = {},
): MediaSlotMeta[] {
  const gallerySlots = listGalleryIndexes(overrides).map(galleryMeta);
  const ministrySlots = ministries.map((ministry) => ({
    id: ministrySlotId(ministry.slug),
    group: "Ministerios",
    label: ministry.name,
    hint: `Imagen o video de ${ministry.name}, en el listado y en su página.`,
  }));
  const hero = fixedCatalog.filter((slot) => slot.id === "hero");
  const rest = fixedCatalog.filter((slot) => slot.id !== "hero");
  const aboutIndex = rest.findIndex((slot) => slot.id === "visit");
  return [...hero, ...gallerySlots, ...rest.slice(0, aboutIndex), ...ministrySlots, ...rest.slice(aboutIndex)];
}

export function isAllowedSlot(id: string) {
  return isGallerySlot(id) || fixedCatalog.some((slot) => slot.id === id) || /^ministry:[a-z0-9-]{1,80}$/.test(id);
}

export function galleryFallback(index: number): MediaAsset {
  const known = galleryDefaults[index - 1];
  if (known) return known;
  const cycle = galleryDefaults[(index - 1) % galleryDefaults.length];
  return { ...cycle, alt: `Foto ${index} del carrusel` };
}

function isAsset(value: unknown): value is MediaAsset {
  if (!value || typeof value !== "object") return false;
  const asset = value as MediaAsset;
  return (asset.kind === "image" || asset.kind === "video") && typeof asset.src === "string" && asset.src.length > 0;
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

export function readOverrides(value: unknown): Record<string, MediaAsset> {
  if (!value || typeof value !== "object") return {};
  const assets = (value as { assets?: unknown }).assets;
  if (!assets || typeof assets !== "object") return {};
  const result: Record<string, MediaAsset> = {};
  for (const [key, raw] of Object.entries(assets)) {
    if (!isAllowedSlot(key) || !isAsset(raw)) continue;
    result[key] = {
      kind: raw.kind,
      src: raw.src,
      poster: typeof raw.poster === "string" ? raw.poster : "",
      alt: typeof raw.alt === "string" ? raw.alt : "",
      ratio: typeof raw.ratio === "string" ? raw.ratio : "natural",
      fit: normalizeFit(typeof raw.fit === "string" ? raw.fit : "fill"),
      posX: clampFocus((raw as MediaAsset).posX),
      posY: clampFocus((raw as MediaAsset).posY),
      zoom: normalizeZoom((raw as MediaAsset).zoom),
      radius: normalizeRadius((raw as MediaAsset).radius),
      feather: normalizeFeather((raw as MediaAsset).feather),
    };
  }
  return result;
}

function resolve(overrides: Record<string, MediaAsset>, id: string, fallback: MediaAsset): MediaAsset {
  const asset = overrides[id];
  if (!asset) return fallback;
  return normalize(asset, fallback);
}

export type ResolvedMedia = {
  hero: MediaAsset;
  gallery: MediaAsset[];
  mareaFamily: MediaAsset;
  mareaCulto: MediaAsset;
  mareaCiudad: MediaAsset;
  aboutPastors: MediaAsset;
  visit: MediaAsset;
  sermons: MediaAsset;
  baptism: MediaAsset;
  giving: MediaAsset;
  contact: MediaAsset;
  login: MediaAsset;
  ministry: (slug: string, name: string) => MediaAsset;
  overrides: Record<string, MediaAsset>;
};

export function resolveMedia(overrides: Record<string, MediaAsset>): ResolvedMedia {
  const hero = resolve(overrides, "hero", fixedDefaults.hero);
  return {
    hero,
    gallery: listGalleryIndexes(overrides).map((index) =>
      resolve(overrides, gallerySlotId(index), galleryFallback(index)),
    ),
    mareaFamily: resolve(overrides, "marea-family", fixedDefaults["marea-family"]),
    mareaCulto: resolve(overrides, "marea-culto", fixedDefaults["marea-culto"]),
    mareaCiudad: resolve(overrides, "marea-ciudad", fixedDefaults["marea-ciudad"]),
    aboutPastors: resolve(overrides, "about-pastors", fixedDefaults["about-pastors"]),
    visit: resolve(overrides, "visit", fixedDefaults.visit),
    sermons: resolve(overrides, "sermons", fixedDefaults.sermons),
    baptism: resolve(overrides, "baptism", fixedDefaults.baptism),
    giving: resolve(overrides, "giving", fixedDefaults.giving),
    contact: resolve(overrides, "contact", fixedDefaults.contact),
    login: overrides.login ? resolve(overrides, "login", fixedDefaults.hero) : hero,
    ministry: (slug, name) => resolve(overrides, ministrySlotId(slug), ministryFallback(slug, name)),
    overrides,
  };
}

export function fallbackForSlot(id: string, ministries: { slug: string; name: string }[] = []): MediaAsset {
  if (isGallerySlot(id)) return galleryFallback(galleryIndex(id));
  if (fixedDefaults[id]) return fixedDefaults[id];
  if (id === "login") return fixedDefaults.hero;
  const ministry = ministries.find((item) => ministrySlotId(item.slug) === id);
  if (ministry) return ministryFallback(ministry.slug, ministry.name);
  return { kind: "image", src: "", poster: "", alt: "" };
}

export function videoMime(src: string) {
  return src.toLowerCase().split("?")[0].endsWith(".webm") ? "video/webm" : "video/mp4";
}

export function classifyUpload(file: File): MediaKind | null {
  const type = file.type.toLowerCase();
  const name = file.name.toLowerCase();
  if (["image/jpeg", "image/png", "image/webp", "image/gif"].includes(type)) return "image";
  if (["video/mp4", "video/webm"].includes(type)) return "video";
  if (/\.(jpe?g|png|webp|gif)$/.test(name)) return "image";
  if (/\.(mp4|webm)$/.test(name)) return "video";
  return null;
}

export function uploadTooLarge(kind: MediaKind, size: number) {
  return size > (kind === "video" ? VIDEO_LIMIT : IMAGE_LIMIT);
}

export function storagePathFromPublicUrl(src: string) {
  const marker = "/storage/v1/object/public/medios/";
  const index = src.indexOf(marker);
  if (index === -1) return null;
  return decodeURIComponent(src.slice(index + marker.length).split("?")[0]);
}
