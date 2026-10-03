import { fontStack } from "./fonts";
import { hex, paletteStyle, resolvePalette } from "./palette";
import type { ArtRule, Backdrop, Design, FontRole, PageRule, SectionRule, Typography } from "./types";

const TITLES = ":is(h1, h2, h3, h4, h5, h6, .editorial, .headline, .display)";
const TEXTS = ":is(p, li, dd, dt, blockquote, figcaption, cite, small, label)";

/** CSS variables and data attributes of a page: palette, the three font roles, sizes and shape. */
export function designAttributes(design: Design | undefined, page: string | undefined) {
  const rule = (design && page && design.pages?.[page]) || {};
  const tokens = resolvePalette(design);
  if (rule.background) tokens.paper = hex(rule.background, tokens.paper);
  if (rule.titleColor) tokens.ink = hex(rule.titleColor, tokens.ink);
  if (rule.textColor) tokens.muted = hex(rule.textColor, tokens.muted);
  if (rule.accentColor) tokens.accent = hex(rule.accentColor, tokens.accent);
  const style = paletteStyle(tokens);
  const attrs: Record<string, string> = {};
  if (!design) return { style, attrs };

  const faces = { heading: fontStack(design.fonts.heading), text: fontStack(design.fonts.text), accent: fontStack(design.fonts.accent) };
  style["--face-heading"] = faces.heading;
  style["--face-text"] = faces.text;
  style["--face-accent"] = faces.accent;
  style["--font-heading"] = faces[rule.titleFont ?? "heading"];
  style["--font-text"] = faces[rule.textFont ?? "text"];
  style["--font-accent"] = faces.accent;

  const title = rule.title ?? design.sizes.title;
  const subtitle = rule.subtitle ?? design.sizes.subtitle;
  const text = rule.text_size ?? design.sizes.text;
  attrs["data-shape"] = design.shape || "round";
  if (page) attrs["data-design-page"] = page;
  if (title !== 1 || subtitle !== 1 || text !== 1) {
    attrs["data-sized"] = "true";
    style["--zoe-title-scale"] = String(title);
    style["--zoe-subtitle-scale"] = String(subtitle);
    style["--zoe-text-scale"] = String(text);
  }
  const nav = design.nav ?? {};
  if (nav.font && ROLES.includes(nav.font)) style["--nav-face"] = faces[nav.font];
  const navSize = number(nav.size, 12, 19);
  const dropSize = number(nav.dropSize, 12, 18);
  const navWeight = number(nav.weight, 300, 700);
  const dropWeight = number(nav.dropWeight, 300, 700);
  const navTracking = number(nav.tracking, -0.03, 0.2);
  if (navSize) style["--nav-size"] = `${navSize}px`;
  if (dropSize) style["--nav-drop-size"] = `${dropSize}px`;
  if (navWeight) style["--nav-weight"] = String(Math.round(navWeight / 100) * 100);
  if (dropWeight) style["--nav-drop-weight"] = String(Math.round(dropWeight / 100) * 100);
  if (navTracking !== undefined) style["--nav-tracking"] = `${navTracking}em`;
  return { style, attrs };
}

const KEY = /^[a-z0-9][a-z0-9-]{0,39}$/;
const ROLES: FontRole[] = ["heading", "text", "accent"];
const PAGE = "html [data-design-page]";
const PARAGRAPHS = ":is(p, li, blockquote, figcaption)";
const color = (value?: string) => hex(value, "");
const face = (role?: FontRole) => (role && ROLES.includes(role) ? `var(--face-${role})` : "");
const number = (value: unknown, min: number, max: number) => (typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : undefined);

/** Only files uploaded to the site's own library can be painted as a background. */
export const MEDIA_PATH = /^\/media\/[A-Za-z0-9][A-Za-z0-9/_.-]*\.(jpe?g|png|webp|gif|avif|mp4|webm|mov)$/i;
const media = (value?: string) => (value && MEDIA_PATH.test(value) && !value.includes("..") ? value : "");

/** Translucent layer of the overlay color on top of a picture or video. */
export function tint(rule: Backdrop) {
  const amount = number(rule.overlay, 0, 0.85);
  return amount ? `color-mix(in srgb, ${color(rule.overlayColor) || "#000000"} ${Math.round(amount * 100)}%, transparent)` : "";
}

/** Background declarations of a page or band: color, gradient, picture or GIF and its tint. */
function backdropCss(rule: Backdrop, colorAlone: boolean) {
  const base = color(rule.background);
  const end = color(rule.background2);
  const image = media(rule.image);
  const shade = image ? tint(rule) : "";
  const layers: [string, string, string, string][] = [];
  if (shade) layers.push([`linear-gradient(${shade}, ${shade})`, "100% 100%", "no-repeat", "center"]);
  if (image) {
    const fit = rule.imageFit === "contain" ? "contain" : rule.imageFit === "repeat" ? "auto" : "cover";
    layers.push([`url("${image}")`, fit, rule.imageFit === "repeat" ? "repeat" : "no-repeat", `${number(rule.imageX, 0, 100) ?? 50}% ${number(rule.imageY, 0, 100) ?? 50}%`]);
  }
  if (end) layers.push([`linear-gradient(${number(rule.gradient, 0, 360) ?? 180}deg, ${base || "var(--paper)"}, ${end})`, "100% 100%", "no-repeat", "center"]);
  if (!layers.length) return base && colorAlone ? [`background: ${base}`] : [];
  return [
    ...(base ? [`background-color: ${base}`] : []),
    `background-image: ${layers.map((layer) => layer[0]).join(", ")}`,
    `background-size: ${layers.map((layer) => layer[1]).join(", ")}`,
    `background-repeat: ${layers.map((layer) => layer[2]).join(", ")}`,
    `background-position: ${layers.map((layer) => layer[3]).join(", ")}`,
    `background-attachment: ${rule.fixed ? "fixed" : "scroll"}`,
  ];
}

/** Weight, line height, letter spacing and style of titles and paragraphs under `at`. */
function typographyCss(at: string, rule: Typography & { text_size?: number }) {
  const out: string[] = [];
  const titles: string[] = [];
  const texts: string[] = [];
  const titleWeight = number(rule.titleWeight, 100, 900);
  const textWeight = number(rule.textWeight, 100, 900);
  if (titleWeight) titles.push(`font-weight: ${Math.round(titleWeight / 100) * 100}`);
  if (number(rule.titleLeading, 0.8, 1.8)) titles.push(`line-height: ${number(rule.titleLeading, 0.8, 1.8)}`);
  if (number(rule.titleTracking, -0.06, 0.3) !== undefined) titles.push(`letter-spacing: ${number(rule.titleTracking, -0.06, 0.3)}em`);
  if (rule.titleUpper) titles.push("text-transform: uppercase");
  if (rule.titleItalic) titles.push("font-style: italic");
  if (textWeight) texts.push(`font-weight: ${Math.round(textWeight / 100) * 100}`);
  if (number(rule.textLeading, 1.1, 2.4)) texts.push(`line-height: ${number(rule.textLeading, 1.1, 2.4)}`);
  if (number(rule.textTracking, -0.03, 0.2) !== undefined) texts.push(`letter-spacing: ${number(rule.textTracking, -0.03, 0.2)}em`);
  if (titles.length) out.push(`${at} ${TITLES} { ${titles.join("; ")}; }`);
  if (texts.length) out.push(`${at} ${TEXTS} { ${texts.join("; ")}; }`);
  const size = number(rule.text_size, 0.75, 1.4);
  if (size && size !== 1) out.push(`${at} ${PARAGRAPHS} { zoom: ${size}; }`, `${at} ${PARAGRAPHS} ${PARAGRAPHS} { zoom: 1; }`);
  return out;
}

/** The page as a whole: screen background (gradient, picture, video) and typography. Colors and sizes travel as variables. */
function pageCss(rule: PageRule) {
  const own = backdropCss(rule, false);
  if (media(rule.video)) own.push("isolation: isolate");
  return [...(own.length ? [`${PAGE} { ${own.join("; ")}; }`] : []), ...typographyCss(PAGE, { ...rule, text_size: undefined })];
}

function sectionCss(key: string, rule: SectionRule, preview: boolean) {
  const at = `${PAGE} [data-section="${key}"]`;
  const own: string[] = backdropCss(rule, true);
  const out: string[] = [];
  if (media(rule.video)) own.push("isolation: isolate");
  if (color(rule.accentColor)) own.push(`--accent: ${color(rule.accentColor)}`);
  if (face(rule.titleFont)) own.push(`--font-heading: ${face(rule.titleFont)}`);
  if (face(rule.textFont)) own.push(`--font-text: ${face(rule.textFont)}`, "font-family: var(--font-text)");
  if (rule.hidden) own.push(preview ? "opacity: 0.35; filter: grayscale(1)" : "display: none !important");
  if (own.length) out.push(`${at} { ${own.join("; ")}; }`);
  if (color(rule.titleColor)) out.push(`${at} ${TITLES} { color: ${color(rule.titleColor)}; }`);
  if (color(rule.textColor)) out.push(`${at} ${TEXTS} { color: ${color(rule.textColor)}; }`);
  const title = Number(rule.title);
  if (title && title !== 1) out.push(`${at} :is(h1, h2, h3) { zoom: ${Math.max(0.75, Math.min(1.4, title))}; }`);
  return [...out, ...typographyCss(at, rule)];
}

function artCss(key: string, rule: ArtRule, preview: boolean) {
  const at = `[data-art="${key}"]`;
  const out: string[] = [];
  const vars = Object.entries(rule.colors ?? {})
    .filter(([slot, value]) => KEY.test(slot) && color(value))
    .map(([slot, value]) => (slot === "accent" ? `--accent: ${color(value)}` : `--art-${slot}: ${color(value)}`));
  if (vars.length) out.push(`${at} { ${vars.join("; ")}; }`);
  if (rule.hidden) out.push(`${at} { ${preview ? "opacity: 0.3; filter: grayscale(1)" : "display: none !important"}; }`);
  if (rule.still) out.push(`${at}, ${at} *, ${at}::before, ${at}::after, ${at} *::before, ${at} *::after { animation-duration: 0s !important; animation-delay: 0s !important; animation-iteration-count: 1 !important; }`);
  return out;
}

/** Stylesheet for the sections and illustrations of the current page. */
export function designCss(design: Design | undefined, page: string | undefined, preview = false) {
  if (!design) return "";
  const rule = (page && design.pages?.[page]) || {};
  const sections = Object.entries(rule.sections || {})
    .filter(([key]) => KEY.test(key))
    .flatMap(([key, section]) => sectionCss(key, section, preview));
  const art = Object.entries(design.art || {})
    .filter(([key]) => KEY.test(key))
    .flatMap(([key, value]) => artCss(key, value, preview));
  return [...pageCss(rule), ...sections, ...art].join("\n");
}

/** Every video background of the page: the screen one first, then one per band. */
export function backdropVideos(design: Design | undefined, page: string | undefined) {
  const rule = (design && page && design.pages?.[page]) || {};
  const list: { section: string | null; src: string; tint: string; fixed: boolean }[] = [];
  if (media(rule.video)) list.push({ section: null, src: media(rule.video), tint: tint(rule), fixed: true });
  Object.entries(rule.sections || {}).forEach(([key, section]) => {
    if (KEY.test(key) && media(section.video) && !section.hidden) list.push({ section: key, src: media(section.video), tint: tint(section), fixed: Boolean(section.fixed) });
  });
  return list;
}
