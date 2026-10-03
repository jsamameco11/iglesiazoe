import { useState } from "react";
import type { ArtRule, Design, FontOption, FontRole, NavType, PageRule, Palette, SectionRule } from "@/lib/design";

/** Drops empty values so "same as the site" never gets saved as a rule. */
function compact<T extends object>(rule: T): T | undefined {
  const entries = Object.entries(rule).filter(([, value]) => value !== "" && value !== undefined && value !== null && value !== false && !(typeof value === "object" && !Object.keys(value).length));
  return entries.length ? (Object.fromEntries(entries) as T) : undefined;
}

function place<T>(map: Record<string, T> | undefined, key: string, value: T | undefined) {
  const next = { ...(map ?? {}) };
  if (value === undefined) delete next[key];
  else next[key] = value;
  return next;
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable((value as Record<string, unknown>)[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

/** The unpublished design the editor works on, with one setter per part. */
export function useDraft(published: Design) {
  const stored: Design = { ...published, pages: { ...published.pages }, art: { ...published.art } };
  const [design, setDesign] = useState<Design>(stored);
  const update = (change: (current: Design) => Design) => setDesign((current) => change(current));

  return {
    design,
    dirty: stable(design) !== stable(stored),
    discard: () => setDesign(stored),
    setPalette: (patch: Partial<Palette>) => update((current) => ({ ...current, palette: { ...current.palette, ...patch } })),
    setFont: (role: FontRole, font: FontOption) => update((current) => ({ ...current, fonts: { ...current.fonts, [role]: font } })),
    setSize: (key: keyof Design["sizes"], value: number) => update((current) => ({ ...current, sizes: { ...current.sizes, [key]: value } })),
    setShape: (shape: Design["shape"]) => update((current) => ({ ...current, shape })),
    setNav: (patch: Partial<NavType>) =>
      update(({ nav, ...current }) => {
        const next = compact({ ...(nav ?? {}), ...patch });
        return next ? { ...current, nav: next } : current;
      }),
    setPage: (page: string, patch: Partial<PageRule> | null) =>
      update((current) => {
        const rule = patch ? compact({ ...(current.pages[page] ?? {}), ...patch }) : undefined;
        return { ...current, pages: place(current.pages, page, rule) };
      }),
    setSection: (page: string, section: string, patch: Partial<SectionRule> | null) =>
      update((current) => {
        const rule = current.pages[page] ?? {};
        const next = patch ? compact({ ...(rule.sections?.[section] ?? {}), ...patch }) : undefined;
        const sections = compact(place(rule.sections, section, next));
        return { ...current, pages: place(current.pages, page, compact({ ...rule, sections })) };
      }),
    setArt: (key: string, patch: Partial<ArtRule> | null) =>
      update((current) => {
        const rule = patch ? { ...(current.art[key] ?? {}), ...patch } : {};
        const colors = compact(rule.colors ?? {});
        return { ...current, art: place(current.art, key, compact({ ...rule, colors, speed: rule.speed === 1 ? undefined : rule.speed })) };
      }),
  };
}

export type Draft = ReturnType<typeof useDraft>;
