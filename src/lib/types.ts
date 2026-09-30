export type Role = "superadmin" | "admin" | "red_leader" | "cell_leader";

export type Profile = {
  id: string;
  username: string;
  full_name: string | null;
  role: Role;
  network_id: string | null;
};

export type SiteSettings = {
  heroTitle: string;
  heroSubtitle: string;
  city: string;
  address: string;
  sunday: string;
  wednesday: string;
  pastor: string;
  pastorsLabel: string;
  aboutQuote: string;
  aboutText: string;
  vision: string;
  history: string;
  values: { title: string; text: string }[];
  facebook: string;
  youtube: string;
  mapUrl: string;
  liveYoutubeId: string;
  bankSoles: string;
  bankSolesCci: string;
  bankDollars: string;
  bankDollarsCci: string;
  yape: string;
  cardUrl: string;
  phone: string;
  email: string;
  headingColor: string;
  bodyColor: string;
  fontPair: "mixed" | "grotesque" | "editorial";
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
  file_path: string | null;
  active: boolean;
};
