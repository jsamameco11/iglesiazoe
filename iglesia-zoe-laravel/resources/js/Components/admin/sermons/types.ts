import type { SermonSummary } from "@/lib/types";

export type AdminSermon = SermonSummary & {
  published: boolean;
  pending: boolean;
  source: "manual" | "youtube";
  youtube_title: string | null;
  title_locked: boolean;
  synced_at: string | null;
};

export type WatchRun = {
  at: string;
  trigger: "auto" | "manual" | "history";
  source?: "api" | "pages";
  found?: number;
  added?: number;
  pending?: number;
  updated?: number;
  skipped?: Record<string, number>;
  titles?: string[];
  seconds?: number;
  error?: string;
};

export type WatchSettings = {
  mode: "auto" | "review" | "off";
  every_hours: number;
  start_hour: number;
  filter: "streams" | "all";
  min_minutes: number;
  since: string | null;
  channel_url: string | null;
  preacher: string;
  series_sunday: string;
  series_weekday: string;
  channel: string;
  has_api_key: boolean;
  last_run_at: string | null;
  next_run_at: string | null;
  runs: WatchRun[];
  ignored: number;
  running: boolean;
};
