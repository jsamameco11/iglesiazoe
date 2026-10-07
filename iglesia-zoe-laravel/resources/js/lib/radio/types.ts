export type RadioKind = "musica" | "anuncio" | "efecto" | "programa" | "vivo" | "relleno" | "automatica";

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

/** Gains of the program; `voice` is what music and sounds drop to while the host's voice is detected. */
/** `fx` drives beds, players and scheduled layers; `pads` the botonera (the layers level when absent). */
export type RadioMix = { music: number; fx: number; pads?: number; bed: number; duck: number; voice?: number };

export type RadioLive = {
  on: boolean;
  session: string | null;
  /** Name of the episode or transmission on air: the one written in the console, or the scheduled live block. */
  title: string;
  mic: boolean;
  started_at: number | null;
  rev: number;
  mode?: LiveMode;
  source?: LiveSource;
  /** The automatic music is cut for the live signal. */
  cut?: boolean;
  window?: LiveWindow | null;
  /** External live signal (OBS / Icecast) that listeners play during the cut. */
  url?: string | null;
};

export type LiveMode = "auto" | "manual";

export type LiveSource = "consola" | "externo";

/** A cut of the automatic music: from `start` until `end` (null until the operator returns). */
export type LiveWindow = { start: number; end: number | null; auto: boolean; bed: boolean; slot: string | null; title: string };

/** What sounds: the chosen list; for random songs every list or every song of the library; or nothing. */
export type AutopilotLevel = "playlist" | "lists" | "library" | "none";

export type AutopilotMode = "lista" | "aleatorio";

/** A song boundary of the automatic music where a change of source can land: when, and what ends there. */
export type SwitchPoint = { at: number; after: { title: string; artist: string | null; kind: RadioKind } | null };

/** When a change of the automatic music lands: when the song on air ends, or at a boundary chosen by hand. */
export type SwitchTiming = { when: "song" } | { when: "at"; at: number };

/**
 * The automatic music of the gaps; `broken` counts audios off the air because their file failed the checks.
 * While a change is scheduled (`since` ahead), `pending` is what keeps playing until then.
 */
export type Autopilot = {
  mode?: AutopilotMode;
  playlist: string | null;
  shuffle: boolean;
  /** Song the operator chose to start the music with (null = from the top). */
  start?: string | null;
  label: string;
  since: number;
  pending?: { label: string } | null;
  paused: boolean;
  /** Off: the source plays each song once; `until` is when that last cycle ends and `finished` that the radio is silent. */
  repeat?: boolean;
  until?: number | null;
  finished?: boolean;
  level?: AutopilotLevel;
  broken?: number;
};

/** A healthy song the listener's player falls back on when a file fails or the server stops answering. */
export type RadioReserveSong = { id: string; title: string; artist: string | null; src: string; ms: number };

export type RadioPlaylist = {
  id: string;
  name: string;
  description: string | null;
  count: number;
  seconds: number;
  tracks?: string[];
};

export type RadioState = {
  now: number;
  name: string;
  tagline: string;
  /** Listeners see the name and artist of the song on air. */
  show_titles: boolean;
  on_air: boolean;
  stream: string | null;
  previous: RadioItem | null;
  queue: RadioItem[];
  /** What sounded before the item on air, newest first: songs, programs and live shows. */
  recent?: RadioItem[];
  fallback?: RadioReserveSong[];
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
  kind: Exclude<RadioKind, "vivo" | "relleno" | "automatica">;
  title: string;
  artist: string | null;
  /** Co-authors of a song, besides its main author (up to 4). */
  featured?: string[];
  album?: string | null;
  /** Musical styles of a song, the main one first. */
  genres?: RadioGenre[];
  year?: number | null;
  /** Cover art of a song, read from its file or uploaded. */
  cover?: string | null;
  src: string;
  duration: number;
  rotation: boolean;
  duck: boolean;
  active: boolean;
  upcoming?: number;
  /** Why the file is off the air (missing, empty or unplayable), or null when it is healthy. */
  problem?: string | null;
  /** Episodes of /radio that play this audio (library only). */
  episodes?: number;
  /** Cut or treated in the audio editor (the original is kept aside). */
  edited?: boolean;
  /** The audio editor is rendering a new edit of this audio. */
  editing?: boolean;
};

/** A musical style of the catalog; `family` groups them (cristiana, pop, rock…). */
export type RadioGenre = { id: string; name: string; family: string };

/** What the internet says of a song: author, co-authors, album, styles and cover. */
export type SongIdentity = {
  found: boolean;
  confidence: "alta" | "media" | "baja" | null;
  sources: string[];
  title: string | null;
  artist: string | null;
  featured: string[];
  album: string | null;
  year: number | null;
  cover_url: string | null;
  genres: RadioGenre[];
  /** Fields filled by inference rather than read from a source, for the admin to check. */
  guessed?: ("genres" | "year")[];
  artist_info: { name: string | null; kind: string | null; country: string | null; known: boolean; convert: boolean; musicbrainz_id: string | null };
  identity: { confidence?: string; score?: number; sources?: string[]; ids?: Record<string, string> };
};

/** A recorded program published on /radio. */
export type RadioEpisode = {
  id: string;
  title: string;
  program: string | null;
  description: string | null;
  cover: string | null;
  src: string | null;
  duration: number;
  aired_on: string;
};

export type RadioEpisodeAdmin = RadioEpisode & { track_id: string; track_title: string | null; published: boolean };

export type RadioConfig = {
  name: string;
  tagline: string;
  on_air: boolean;
  autofill: boolean;
  show_titles: boolean;
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
  auto_playlist: string | null;
  auto_shuffle: boolean;
  /** Minimum notice of a change of the automatic music, in seconds (30 to 1800). */
  live_mode: LiveMode;
  live_source: LiveSource;
  live_url: string;
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
  /** Automatic-music periods: their playlist (null = random songs) and order. */
  playlist_id: string | null;
  playlist: string | null;
  shuffle: boolean;
  src: string | null;
  inactive: boolean;
  start: number;
  end: number;
};

/** A main-program block the console warns about; `held` waits for the live transmission to end. */
export type RadioUpcoming = RadioBlock & { held: boolean };

/** How long before a scheduled block the console warns about it. */
export const ALERT_AHEAD = 15 * 60000;

export const KIND_LABEL: Record<RadioKind, string> = {
  musica: "Música",
  anuncio: "Anuncio",
  efecto: "Efecto",
  programa: "Programa",
  vivo: "En vivo",
  relleno: "Música continua",
  automatica: "Música automática",
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
