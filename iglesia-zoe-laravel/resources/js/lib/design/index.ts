import type { FooterPart, FooterRule, TextAlign } from "./types";

export * from "./types";
export { hex, readableInk, resolvePalette, zoePalette } from "./palette";
export { designFonts, fontRoles, fontStack, fontHref } from "./fonts";
export { PREVIEW_PARAM, type EditorMessage, type PageMessage, type PickMode } from "./preview";
export { useArt, useFooterDesign, useSiteDesign } from "./hooks";

/** Marks a block of a page as a section the Diseño editor can restyle. */
export function section(key: string, label: string) {
  return { "data-section": key, "data-section-label": label };
}

/** Footer text alignment; a centered crest centers the name and slogan unless they were aligned on purpose. */
export function footerAlign(rule: FooterRule, part: FooterPart): TextAlign {
  const crest = rule.logo && rule.logoPlace === "center" && (part === "brand" || part === "slogan");
  return rule[part]?.align ?? (crest ? "center" : "left");
}
