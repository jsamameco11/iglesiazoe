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

export type FontRole = "heading" | "text" | "accent";
export type FontKind = "serif" | "sans" | "round";
export type FontOption = { name: string; slug: string; kind: FontKind; local?: boolean };

/** Look of one section of a page; every field is optional and falls back to the page. */
export type SectionRule = {
  background?: string;
  titleColor?: string;
  textColor?: string;
  accentColor?: string;
  titleFont?: FontRole;
  textFont?: FontRole;
  title?: number;
  hidden?: boolean;
};

export type PageRule = Omit<SectionRule, "hidden"> & {
  subtitle?: number;
  text_size?: number;
  sections?: Record<string, SectionRule>;
};

export type ArtRule = { hidden?: boolean; still?: boolean; speed?: number; colors?: Record<string, string> };

export type Design = {
  palette: Palette;
  fonts: Record<FontRole, FontOption>;
  sizes: { title: number; subtitle: number; text: number };
  shape: "round" | "soft" | "square";
  pages: Record<string, PageRule>;
  art: Record<string, ArtRule>;
  fontHref?: string;
};

export type ArtSpec = { key: string; label: string; text: string; page: string | null; canHide: boolean; colors: { key: string; label: string; value: string }[] };
export type DesignPage = { key: string; label: string; url: string };
export type SectionInfo = { key: string; label: string };
