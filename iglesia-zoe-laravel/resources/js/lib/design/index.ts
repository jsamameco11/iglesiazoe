export * from "./types";
export { zoePalette } from "./palette";
export { fontRoles, fontStack, fontHref } from "./fonts";
export { PREVIEW_PARAM, type EditorMessage, type PageMessage } from "./preview";
export { useArt, useSiteDesign } from "./hooks";

/** Marks a block of a page as a section the Diseño editor can restyle. */
export function section(key: string, label: string) {
  return { "data-section": key, "data-section-label": label };
}
