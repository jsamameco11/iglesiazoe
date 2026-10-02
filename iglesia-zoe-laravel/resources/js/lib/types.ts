export type SiteSettings = {
  heroTitle: string;
  heroSubtitle: string;
  city: string;
  address: string;
  sunday: string;
  wednesday: string;
  pastorsLabel: string;
  aboutQuote: string;
  aboutText: string;
  vision: string;
  history: string;
  values: { title: string; text: string }[];
  facebook: string;
  youtube: string;
  instagram: string;
  tiktok: string;
  messengerUrl: string;
  liveUrl: string;
  mapUrl: string;
  liveYoutubeId: string;
  serviceDayMain: string;
  serviceDayWeek: string;
  prayerTopics: string[];
  copy: Record<string, string>;
  bankSoles: string;
  bankSolesCci: string;
  bankDollars: string;
  bankDollarsCci: string;
  bankHolder: string;
  yape: string;
  yapeHolder: string;
  yapeQr: string;
  cardUrl: string;
  phone: string;
  whatsapp: string;
  email: string;
  visitCta: string;
  baptismCta: string;
  essenceTitle: string;
  essenceText: string;
  cellsTitle: string;
  cellsText: string;
  cellsCta: string;
  generationsTitle: string;
  resourcesTitle: string;
  resourcesText: string;
  visitInviteTitle: string;
  visitInviteText: string;
  footerTagline: string;
  aboutKicker: string;
  aboutTitle: string;
  aboutValuesTitle: string;
  aboutValuesText: string;
  ministriesTitle: string;
  ministriesText: string;
  baptismTitle: string;
  baptismLead: string;
  baptismBody: string;
  baptismDateLabel: string;
  baptismRequirementLabel: string;
  baptismRequirement: string;
  baptismDateFallback: string;
  visitTitle: string;
  visitText: string;
  contactTitle: string;
  prayerTitle: string;
  giveTitle: string;
  giveLead: string;
  giveBody: string;
  giveYapeText: string;
  giveCardText: string;
  giveAbroadText: string;
  bankSwift: string;
  baptismVideo: string;
  baptismVideoTitle: string;
  baptismVideoText: string;
  eventsTitle: string;
  eventsText: string;
  teachingsTitle: string;
  teachingsText: string;
  serveTitle: string;
  serveText: string;
  serveRailTitle: string;
  serveRailText: string;
  routeTitle: string;
  routeText: string;
  routeLevels: SectionItem[];
  sermonsTitle: string;
  sermonsEmpty: string;
};

export type SectionItem = { slot?: number; title: string; text: string };

export type ServeArea = {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  summary: string | null;
  body: string | null;
  teams: string[];
  image: string | null;
  cta_label: string | null;
  cta_url: string | null;
  accepts_volunteers: boolean;
  active: boolean;
};

export type GalleryKind = "dominical" | "media-semana" | "especial";

export type ServiceGallery = {
  id: string;
  slug: string;
  title: string;
  kind: GalleryKind;
  service_date: string;
  summary: string | null;
  cover: string | null;
  count: number;
  active: boolean;
};

export type ServiceGalleryFull = ServiceGallery & { photos: string[] };

export type Devotional = {
  id: string;
  slug: string;
  title: string;
  verse_ref: string | null;
  verse_text: string | null;
  excerpt: string;
  author: string | null;
  publish_on: string;
  image: string | null;
  minutes: number;
  active: boolean;
};

export type DevotionalFull = Devotional & { body: string };

export type ChurchEvent = {
  id: string;
  title: string;
  starts_on: string;
  ends_on: string | null;
  time_label: string | null;
  location: string | null;
  summary: string | null;
  body: string | null;
  image: string | null;
  cta_label: string | null;
  cta_url: string | null;
  active: boolean;
};

export type TeachingKind = "predica" | "gc";

export type Teaching = {
  id: string;
  title: string;
  kind: TeachingKind;
  teaching_date: string;
  summary: string | null;
  file_url: string | null;
  file_type: string | null;
  youtube_id: string | null;
  active: boolean;
};

export type SermonSummary = {
  id: string;
  title: string;
  preacher: string | null;
  series: string | null;
  sermon_date: string | null;
  youtube_id: string | null;
  is_live: boolean;
};

export type Ministry = {
  id?: string;
  slug: string;
  name: string;
  age_range: string;
  summary: string;
  body: string;
  sort_order: number;
  accent: string;
  active?: boolean;
};

export type Cell = {
  id: string;
  network_id: string;
  parent_id: string | null;
  number: number;
  code: string;
  leader_name: string | null;
  assistant_name: string | null;
  host_name: string | null;
  address: string | null;
  meeting_day: string | null;
  meeting_time: string | null;
  active: boolean;
};

export type Member = {
  id: string;
  cell_id: string;
  full_name: string;
  phone: string | null;
  active: boolean;
};

export type Theme = {
  id: string;
  title: string;
  audience: string;
  theme_date: string;
  file_type: string | null;
  file_url: string | null;
  download_url: string | null;
};
