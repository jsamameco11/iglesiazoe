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
export type FontKind = "serif" | "sans" | "round" | "script" | "mono";
export type FontOption = { name: string; slug: string; kind: FontKind; category?: string; local?: boolean };
export type FontCategory = { key: string; label: string; text: string; count: number };

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

export type TextAlign = "left" | "center" | "right";

/** Look of one text picked in the preview. Size is a factor of the original; "box" lets an inline text be aligned on its own line. */
export type TextRule = {
  font?: FontRole | FontOption;
  size?: number;
  align?: TextAlign;
  box?: "block" | "flex" | "grid";
  weight?: number;
  italic?: boolean;
  label?: string;
};

export type PageRule = Omit<SectionRule, "hidden"> & {
  subtitle?: number;
  sections?: Record<string, SectionRule>;
  texts?: Record<string, TextRule>;
};

/** A text the editor picked in the preview, as the page reports it. */
export type TextPick = { path: string; label: string; tag: string; display: string };

/** Menu bar links and the options that drop from them; every field falls back to the original look. Sizes in px, tracking in em. */
export type NavType = {
  font?: FontRole;
  size?: number;
  weight?: number;
  dropSize?: number;
  dropWeight?: number;
  tracking?: number;
};

export type ArtRule = { hidden?: boolean; still?: boolean; speed?: number; colors?: Record<string, string> };

export type Design = {
  palette: Palette;
  fonts: Record<FontRole, FontOption>;
  sizes: { title: number; subtitle: number; text: number };
  shape: "round" | "soft" | "square";
  nav?: NavType;
  pages: Record<string, PageRule>;
  art: Record<string, ArtRule>;
  fontHref?: string;
};

export type ArtSpec = { key: string; label: string; text: string; page: string | null; canHide: boolean; colors: { key: string; label: string; value: string }[] };
export type DesignPage = { key: string; label: string; url: string };
export type SectionInfo = { key: string; label: string };
