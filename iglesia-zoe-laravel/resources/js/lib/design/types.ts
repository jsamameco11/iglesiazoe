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

export type BackdropFit = "cover" | "contain" | "repeat";

/** Background of a whole page (the screen) or of one band: color, gradient, picture or GIF, video and a tint on top. */
export type Backdrop = {
  background?: string;
  background2?: string;
  gradient?: number;
  image?: string;
  video?: string;
  imageFit?: BackdropFit;
  imageX?: number;
  imageY?: number;
  fixed?: boolean;
  overlay?: number;
  overlayColor?: string;
};

/** Fine typography of titles and paragraphs. Tracking is in em. */
export type Typography = {
  titleWeight?: number;
  textWeight?: number;
  titleLeading?: number;
  textLeading?: number;
  titleTracking?: number;
  textTracking?: number;
  titleUpper?: boolean;
  titleItalic?: boolean;
};

/** Look of one section of a page; every field is optional and falls back to the page. */
export type SectionRule = Backdrop & Typography & {
  titleColor?: string;
  textColor?: string;
  accentColor?: string;
  titleFont?: FontRole;
  textFont?: FontRole;
  title?: number;
  text_size?: number;
  hidden?: boolean;
};

export type PageRule = Omit<SectionRule, "hidden"> & {
  subtitle?: number;
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
