export type RadioKind = "musica" | "anuncio" | "efecto" | "programa" | "vivo" | "relleno";

export type RadioItem = {
  id: string;
  kind: RadioKind;
  title: string;
  artist: string | null;
  src: string | null;
  start: number;
  end: number;
  origin: number;
  seek: number;
  bed: boolean;
  block: string | null;
  slot: string | null;
  /** Library audio that sounds; a song of the continuous music when `slot` is null. */
  track?: string | null;
};

/** A sound on top of the program: a console pad or player, or an overlay block of the timeline. */
export type RadioLayer = {
  id: string;
  lane: string;
  track_id: string | null;
  title: string;
  kind: string;
  src: string;
  start: number;
  end: number;
  volume: number;
  duck: boolean;
  source: "live" | "schedule";
  /** Seconds of fade in after `start` and of fade out before `end`. */
  fade_in?: number;
  fade_out?: number;
  /** Repeats until stopped; `length` is one pass, in ms. */
  loop?: boolean;
  length?: number;
  /** Fading out after a stop or a crossfade. */
  fading?: boolean;
};

export type RadioMix = { music: number; fx: number; bed: number; duck: number };

export type RadioLive = {
  on: boolean;
  session: string | null;
  host: string;
  mic: boolean;
  started_at: number | null;
  rev: number;
};

export type RadioState = {
  now: number;
  name: string;
  tagline: string;
  on_air: boolean;
  stream: string | null;
  previous: RadioItem | null;
  queue: RadioItem[];
  layers: RadioLayer[];
  next_show: { title: string; kind: RadioKind; start: number } | null;
  live: RadioLive;
  mix: RadioMix;
  listeners: number;
  ice: RTCIceServer[];
  voice?: { state: string; offer: string | null; since?: number | null };
};

export type RadioTrack = {
  id: string;
  kind: Exclude<RadioKind, "vivo" | "relleno">;
  title: string;
  artist: string | null;
  src: string;
  duration: number;
  rotation: boolean;
  duck: boolean;
  active: boolean;
  upcoming?: number;
};

export type RadioConfig = {
  name: string;
  tagline: string;
  on_air: boolean;
  autofill: boolean;
  bed_level: number;
  fx_level: number;
  duck_level: number;
  crossfade: number;
  pads: string[] | null;
  stream_url: string;
  turn_url: string;
  turn_username: string;
  turn_credential: string;
  max_voice: number;
};

export type RadioBlock = {
  id: string;
  kind: RadioKind;
  layer: number;
  title: string;
  artist: string | null;
  note: string | null;
  bed: boolean;
  duck: boolean;
  volume: number;
  duration: number;
  track_id: string | null;
  src: string | null;
  inactive: boolean;
  start: number;
  end: number;
};

export const KIND_LABEL: Record<RadioKind, string> = {
  musica: "Música",
  anuncio: "Anuncio",
  efecto: "Efecto",
  programa: "Programa",
  vivo: "En vivo",
  relleno: "Música continua",
};

/** Timeline layers: 0 is the main program, the rest sound on top of it. */
export const LAYERS = [0, 1, 2, 3] as const;

export function layerLabel(layer: number) {
  return layer === 0 ? "Pista principal" : `Capa ${layer}`;
}

/** Console players that sound at the same time as the program. */
export const PLAYERS = ["A", "B", "C"] as const;

/** Background beds: looped sounds under the voice, changed with a crossfade. */
export const BEDS = ["F1", "F2"] as const;

/** Fade and crossfade choices of the console, in seconds. */
export const FADES = [0, 1, 2, 3, 5, 8, 12] as const;

export function laneLabel(lane: string) {
  if (lane === "pad") return "Botonera";
  if ((PLAYERS as readonly string[]).includes(lane)) return `Reproductor ${lane}`;
  if ((BEDS as readonly string[]).includes(lane)) return `Fondo ${lane.slice(1)}`;
  return layerLabel(Number(lane));
}
