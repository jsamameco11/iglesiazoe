export type Palette = {
  paper: string;
  card: string;
  ink: string;
  muted: string;
  line: string;
  accent: string;
  stone: string;
  clay: string;
};

export const zoePalette: Palette = {
  paper: "#f7f4ef",
  card: "#fbf9f6",
  ink: "#2a2623",
  muted: "#6f6a64",
  line: "#e6e1da",
  accent: "#c45c26",
  stone: "#e4dfd6",
  clay: "#e8d0c2",
};

export type PageRule = { heading?: string; text?: string; titleColor?: string; textColor?: string; title?: number; subtitle?: number; text_size?: number };
export type Design = {
  palette: Palette;
  fonts: { heading: string; text: string };
  sizes: { title: number; subtitle: number; text: number };
  shape: "round" | "soft" | "square";
  pages: Record<string, PageRule>;
  fontHref?: string;
};
export type FontOption = { name: string; slug: string; kind: "sans" | "serif" };

export const pageOfComponent: Record<string, string> = {
  Home: "home",
  About: "about",
  Ministries: "ministries",
  Ministry: "ministries",
  Visit: "visit",
  Baptisms: "baptisms",
  Sermons: "sermons",
  Give: "give",
  Contact: "contact",
  Acceso: "acceso",
};

export function fontStack(name: string, fonts?: FontOption[]) {
  const kind = fonts?.find((font) => font.name === name)?.kind ?? (/garamond|playfair|lora|baskerville|fraunces|serif|merriweather/i.test(name) ? "serif" : "sans");
  return `"${name}", ${kind === "serif" ? 'Garamond, "Times New Roman", serif' : "ui-sans-serif, system-ui, sans-serif"}`;
}

export function shade(hex: string, amount: number) {
  const value = hex.replace("#", "");
  const channel = (index: number) => {
    const base = parseInt(value.slice(index, index + 2), 16);
    const next = amount < 0 ? base * (1 + amount) : base + (255 - base) * amount;
    return Math.round(Math.max(0, Math.min(255, next))).toString(16).padStart(2, "0");
  };
  return `#${channel(0)}${channel(2)}${channel(4)}`;
}

export type BasePalette = Partial<Palette> & { headingColor?: string; bodyColor?: string; accentColor?: string; paperColor?: string; stoneColor?: string; clayColor?: string };

function hex(value: string | undefined, fallback: string) {
  return /^#[0-9A-Fa-f]{6}$/.test(value || "") ? (value as string).toLowerCase() : fallback;
}

export function resolvePalette(design: Design | undefined, base: BasePalette = {}): Palette {
  const palette = design?.palette;
  const paper = hex(palette?.paper || base.paper || base.paperColor, zoePalette.paper);
  const ink = hex(palette?.ink || base.ink || base.headingColor, zoePalette.ink);
  const accent = hex(palette?.accent || base.accent || base.accentColor, zoePalette.accent);
  const muted = hex(palette?.muted || base.muted || base.bodyColor, zoePalette.muted);
  const stone = hex(palette?.stone || base.stone || base.stoneColor, zoePalette.stone);
  const clay = hex(palette?.clay || base.clay || base.clayColor, zoePalette.clay);
  return {
    paper,
    card: hex(palette?.card || base.card, zoePalette.card),
    ink,
    muted,
    line: hex(palette?.line || base.line, zoePalette.line),
    accent,
    stone,
    clay,
  };
}

export function paletteStyle(tokens: Palette): Record<string, string> {
  const mix = (a: string, amount: number, b: string) => `color-mix(in srgb, ${a} ${amount}%, ${b})`;
  return {
    "--paper": tokens.paper,
    "--card": tokens.card,
    "--ink": tokens.ink,
    "--muted": tokens.muted,
    "--line": tokens.line,
    "--accent": tokens.accent,
    "--sage": tokens.stone,
    "--dusk": mix(tokens.ink, 8, tokens.stone),
    "--clay": tokens.clay,
    "--amber": mix(tokens.accent, 14, tokens.paper),
    "--blush": mix(tokens.accent, 16, tokens.paper),
    "--mist": tokens.stone,
    "--sky": mix(tokens.ink, 8, tokens.stone),
    "--sage-deep": mix(tokens.ink, 16, tokens.stone),
    "--dusk-deep": mix(tokens.ink, 22, tokens.stone),
    "--clay-deep": mix(tokens.accent, 42, tokens.ink),
    "--amber-deep": mix(tokens.accent, 58, "#8d5430"),
    "--scroll-thumb": mix(tokens.accent, 38, tokens.paper),
    "--scroll-track": tokens.paper,
  };
}

export function designAttributes(design: Design | undefined, page: string | undefined, base: BasePalette = {}) {
  const tokens = resolvePalette(design, base);
  const style = paletteStyle(tokens);
  const rule = (design && page && design.pages?.[page]) || {};
  if (rule.titleColor) style["--ink"] = hex(rule.titleColor, tokens.ink);
  if (rule.textColor) style["--muted"] = hex(rule.textColor, tokens.muted);
  if (!design) return { style, attrs: {} as Record<string, string> };
  style["--font-heading"] = fontStack(rule.heading || design.fonts.heading);
  style["--font-text"] = fontStack(rule.text || design.fonts.text);
  const title = rule.title ?? design.sizes.title;
  const subtitle = rule.subtitle ?? design.sizes.subtitle;
  const text = rule.text_size ?? design.sizes.text;
  const attrs: Record<string, string> = { "data-shape": design.shape || "round" };
  if (title !== 1 || subtitle !== 1 || text !== 1) {
    attrs["data-sized"] = "true";
    style["--zoe-title-scale"] = String(title);
    style["--zoe-subtitle-scale"] = String(subtitle);
    style["--zoe-text-scale"] = String(text);
  }
  return { style, attrs };
}
