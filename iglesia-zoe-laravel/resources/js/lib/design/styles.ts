import { fontStack } from "./fonts";
import { hex, paletteStyle, resolvePalette } from "./palette";
import type { ArtRule, Design, FontRole, SectionRule } from "./types";

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
  return { style, attrs };
}

const KEY = /^[a-z0-9][a-z0-9-]{0,39}$/;
const ROLES: FontRole[] = ["heading", "text", "accent"];
const color = (value?: string) => hex(value, "");
const face = (role?: FontRole) => (role && ROLES.includes(role) ? `var(--face-${role})` : "");

function sectionCss(key: string, rule: SectionRule, preview: boolean) {
  const at = `html [data-design-page] [data-section="${key}"]`;
  const own: string[] = [];
  const out: string[] = [];
  if (color(rule.background)) own.push(`background: ${color(rule.background)}`);
  if (color(rule.accentColor)) own.push(`--accent: ${color(rule.accentColor)}`);
  if (face(rule.titleFont)) own.push(`--font-heading: ${face(rule.titleFont)}`);
  if (face(rule.textFont)) own.push(`--font-text: ${face(rule.textFont)}`, "font-family: var(--font-text)");
  if (rule.hidden) own.push(preview ? "opacity: 0.35; filter: grayscale(1)" : "display: none !important");
  if (own.length) out.push(`${at} { ${own.join("; ")}; }`);
  if (color(rule.titleColor)) out.push(`${at} ${TITLES} { color: ${color(rule.titleColor)}; }`);
  if (color(rule.textColor)) out.push(`${at} ${TEXTS} { color: ${color(rule.textColor)}; }`);
  const title = Number(rule.title);
  if (title && title !== 1) out.push(`${at} :is(h1, h2, h3) { zoom: ${Math.max(0.75, Math.min(1.4, title))}; }`);
  return out;
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
  const sections = Object.entries((page && design.pages?.[page]?.sections) || {})
    .filter(([key]) => KEY.test(key))
    .flatMap(([key, rule]) => sectionCss(key, rule, preview));
  const art = Object.entries(design.art || {})
    .filter(([key]) => KEY.test(key))
    .flatMap(([key, rule]) => artCss(key, rule, preview));
  return [...sections, ...art].join("\n");
}
