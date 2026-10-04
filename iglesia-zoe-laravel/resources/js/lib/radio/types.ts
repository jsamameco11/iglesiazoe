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

export type RadioMix = { music: number; fx: number; bed: number; duck: number };

export type RadioLive = {
  on: boolean;
  session: string | null;
  host: string;
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

/** Level of the fallback chain that sounds: the chosen list, every list, or every song of the library. */
export type AutopilotLevel = "playlist" | "lists" | "library" | "none";

export type AutopilotMode = "spotify" | "lista" | "aleatorio";

/**
 * The automatic music of the gaps; `broken` counts audios off the air because their file failed the checks.
 * While a change is scheduled (`since` ahead), `pending` is what keeps playing until then; `lead` is the
 * minimum notice of a change, in seconds.
 */
export type Autopilot = {
  mode?: AutopilotMode;
  playlist: string | null;
  shuffle: boolean;
  spotify?: string | null;
  label: string;
  since: number;
  pending?: { label: string; spotify: boolean } | null;
  lead?: number;
  paused: boolean;
  level?: AutopilotLevel;
  broken?: number;
};

/** A Spotify playlist the automatic music can play. */
export type RadioSpotifyChoice = { id: string; name: string; cover: string | null };

/**
 * The Spotify side of the automatic music: the playlist filling the gaps now (null while the
 * station's songs do), the one due from `since`, and whether a change is pending.
 */
export type RadioSource = { spotify: RadioSpotifyPlaylist | null; next: RadioSpotifyPlaylist | null; since: number; changing: boolean };

/** A healthy song the listener's player falls back on when a file fails or the server stops answering. */
export type RadioReserveSong = { id: string; title: string; artist: string | null; src: string; ms: number };

export type RadioPlaylist = { id: string; name: string; description: string | null; count: number; seconds: number; tracks?: string[] };

/** A Spotify playlist shown on /radio; it plays in Spotify's own player. */
export type RadioSpotifyPlaylist = { id: string; name: string; description: string | null; cover: string | null; url: string; embed: string };

export type RadioSpotifyPlaylistAdmin = RadioSpotifyPlaylist & { spotify_id: string; published: boolean };

export type RadioState = {
  now: number;
  name: string;
  tagline: string;
  on_air: boolean;
  stream: string | null;
  previous: RadioItem | null;
  queue: RadioItem[];
  fallback?: RadioReserveSong[];
  source?: RadioSource;
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
  auto_spotify?: string | null;
  /** Minimum notice of a change of the automatic music, in seconds (30 to 1800). */
  switch_lead?: number;
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
