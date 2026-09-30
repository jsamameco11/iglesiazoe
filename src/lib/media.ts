export type MediaKind = "image" | "video";

export type MediaAsset = {
  kind: MediaKind;
  src: string;
  poster: string;
  alt: string;
};

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

const galleryDefaults: MediaAsset[] = [
  { kind: "image", src: "/images/banner4.jpg", poster: "", alt: "Culto de la congregación" },
  { kind: "image", src: "/images/man1.jpg", poster: "", alt: "Hermano de la iglesia" },
  { kind: "image", src: "/images/familia1.jpg", poster: "", alt: "Familia de Iglesia Cristiana Zoe" },
  { kind: "image", src: "/images/banner8.jpg", poster: "", alt: "Congregación reunida" },
  { kind: "image", src: "/images/man2.jpg", poster: "", alt: "Hermano de la iglesia" },
];

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
    id: "gallery-1",
    group: "Inicio",
    label: "Carrusel 1",
    hint: "Primera pieza del carrusel de la congregación.",
  },
  {
    id: "gallery-2",
    group: "Inicio",
    label: "Carrusel 2",
    hint: "Segunda pieza del carrusel.",
  },
  {
    id: "gallery-3",
    group: "Inicio",
    label: "Carrusel 3",
    hint: "Tercera pieza del carrusel.",
  },
  {
    id: "gallery-4",
    group: "Inicio",
    label: "Carrusel 4",
    hint: "Cuarta pieza del carrusel.",
  },
  {
    id: "gallery-5",
    group: "Inicio",
    label: "Carrusel 5",
    hint: "Quinta pieza del carrusel.",
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
  if (known) return { kind: "image", src: known, poster: "", alt: name };
  let hash = 0;
  for (const char of slug) hash = (hash + char.charCodeAt(0)) % ministryPool.length;
  return { kind: "image", src: ministryPool[hash], poster: "", alt: name };
}

export function mediaCatalog(ministries: { slug: string; name: string }[]): MediaSlotMeta[] {
  const ministrySlots = ministries.map((ministry) => ({
    id: ministrySlotId(ministry.slug),
    group: "Ministerios",
    label: ministry.name,
    hint: `Imagen o video de ${ministry.name}, en el listado y en su página.`,
  }));
  const aboutIndex = fixedCatalog.findIndex((slot) => slot.id === "visit");
  return [...fixedCatalog.slice(0, aboutIndex), ...ministrySlots, ...fixedCatalog.slice(aboutIndex)];
}

export function isAllowedSlot(id: string) {
  return fixedCatalog.some((slot) => slot.id === id) || /^ministry:[a-z0-9-]{1,80}$/.test(id);
}

function isAsset(value: unknown): value is MediaAsset {
  if (!value || typeof value !== "object") return false;
  const asset = value as MediaAsset;
  return (asset.kind === "image" || asset.kind === "video") && typeof asset.src === "string" && asset.src.length > 0;
}

function normalize(asset: MediaAsset, fallback: MediaAsset): MediaAsset {
  return {
    kind: asset.kind,
    src: asset.src,
    poster: typeof asset.poster === "string" ? asset.poster : "",
    alt: typeof asset.alt === "string" && asset.alt.trim() ? asset.alt.trim() : fallback.alt,
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
    gallery: [1, 2, 3, 4, 5].map((index) => resolve(overrides, `gallery-${index}`, fixedDefaults[`gallery-${index}`])),
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
