import type { Design, Palette } from "./types";

export const zoePalette: Palette = {
  paper: "#fdfcfa",
  card: "#ffffff",
  ink: "#1a1a1a",
  muted: "#5c5853",
  line: "#e7e1d8",
  accent: "#c14a09",
  stone: "#ebe4da",
  clay: "#ead8c9",
};

export function hex(value: string | undefined, fallback: string) {
  return /^#[0-9A-Fa-f]{6}$/.test(value || "") ? (value as string).toLowerCase() : fallback;
}

export function resolvePalette(design: Design | undefined): Palette {
  const palette: Partial<Palette> = design?.palette ?? {};
  return Object.fromEntries(Object.entries(zoePalette).map(([key, fallback]) => [key, hex(palette[key as keyof Palette], fallback)])) as Palette;
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
