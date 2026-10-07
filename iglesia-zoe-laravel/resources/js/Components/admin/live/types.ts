import type { TeachingKind } from "@/lib/types";

export type Choice = { value: string; label: string };

export type VideoOptions = {
  privacy: "public" | "unlisted" | "private";
  category: string;
  tags: string[];
  kids: boolean;
  language: string;
  playlist: string;
  latency: string;
  dvr: boolean;
  embeddable: boolean;
  license: string;
  notify: boolean;
  scheduled_at: string | null;
  publish_at: string | null;
};

export type Catalog = {
  privacy: Choice[];
  categories: Choice[];
  latency: Choice[];
  languages: Choice[];
  licenses: Choice[];
  defaults: VideoOptions;
  kinds?: Choice[];
};

export type Recording = {
  id: string;
  part: number;
  name: string;
  size: number | null;
  duration: number | null;
  status: "pending" | "processing" | "ready" | "failed" | "expired";
  error: string | null;
  expires_at: string | null;
  download: string | null;
};

export type LiveStream = {
  id: string;
  title: string;
  description: string;
  preacher: string;
  kind: TeachingKind;
  show_summary: boolean;
  to_youtube: boolean;
  options: VideoOptions;
  cover: string | null;
  status: "ready" | "live" | "ended" | "cancelled";
  quick: boolean;
  youtube_id: string | null;
  youtube_mode: "api" | "key" | null;
  youtube_error: string | null;
  signal: boolean;
  signal_at: string | null;
  signal_lost_at: string | null;
  started_at: string | null;
  ended_at: string | null;
  end_reason: string | null;
  teaching_id: string | null;
  segments: number;
  recordings: Recording[];
  created_at: string | null;
  teaching?: { id: string; title: string; youtube_id: string | null; youtube_status: string | null } | null;
};

export type ServerStatus = {
  online: boolean;
  ready: boolean;
  since: string | null;
  tracks: string[];
  video: { codec?: string; width?: number; height?: number; fps?: number } | null;
  kbps: number | null;
  viewers: number;
  source: { type?: string; id?: string } | null;
};

export type Encoder = { server: string; key: string; srt: string; path: string };

export type YouTubeInfo = {
  configured: boolean;
  connected: boolean;
  channel: { id: string; title: string; handle: string; thumbnail: string } | null;
  connectedAt: string | null;
  error: string | null;
  ingest: boolean;
  manualKey: boolean;
  relay: "api" | "key" | null;
  redirectUri: string;
};

export type BroadcastDefaults = {
  title: string;
  description: string;
  preacher: string;
  kind: TeachingKind;
  show_summary: boolean;
  to_youtube: boolean;
  options: VideoOptions;
};

export type Playlist = { id: string; title: string };
