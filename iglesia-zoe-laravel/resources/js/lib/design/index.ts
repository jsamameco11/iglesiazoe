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

/** Alignment chosen for a footer text; a centered crest centers the name and slogan unless they were aligned on purpose. */
export function footerAlignChoice(rule: FooterRule, part: FooterPart): TextAlign | undefined {
  const crest = rule.logo && rule.logoPlace === "center" && (part === "brand" || part === "slogan");
  return rule[part]?.align ?? (crest ? "center" : undefined);
}

/** Footer text alignment on wide screens: name and slogan close the right side, titles and links read from the left. */
export function footerAlign(rule: FooterRule, part: FooterPart): TextAlign {
  return footerAlignChoice(rule, part) ?? (part === "brand" || part === "slogan" ? "right" : "left");
}
