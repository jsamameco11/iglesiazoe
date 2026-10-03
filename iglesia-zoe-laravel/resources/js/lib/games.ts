import { csrf } from "@/lib/actions";

export type Theme = { id: string; slug: string; name: string; questions?: number; words?: number };

export type RebetQuestion = {
  id: string;
  question: string;
  options: string[];
  difficulty: "easy" | "medium" | "hard" | "expert";
  category: string | null;
  time_limit: number;
  elapsed?: number;
};

export type RebetGrade = { correct: boolean; points: number; right: number; explanation: string | null; reference: string | null; late: boolean };

export type OcultoCard = {
  impostor: boolean;
  category?: string | null;
  word?: string;
  description?: string | null;
  reference?: string | null;
  clues?: string[];
};

export type RoomPlayer = { id: string; name: string; host: boolean };

export type RoomBase = {
  code: string;
  game: "rebet" | "oculto";
  status: string;
  version: number;
  me: RoomPlayer;
  players: RoomPlayer[];
  max: number;
  error?: string;
  closed?: boolean;
  left?: boolean;
};

export type RebetRoomState = RoomBase & {
  settings: { categories: string[]; difficulty: string; count: number };
  total?: number;
  mine?: {
    index: number;
    answered: boolean;
    score: number;
    correct: number;
    streak: number;
    best: number;
    done: boolean;
    question: RebetQuestion | null;
  } | null;
  board?: { id: string; name: string; score: number; correct: number; answered: number; done: boolean }[];
  result?: RebetGrade;
};

export type OcultoRoomState = RoomBase & {
  settings: { categories: string[]; impostors: number; clue_rounds: number; rounds: number };
  notice?: string | null;
  card?: OcultoCard;
  round?: number;
  rounds?: number;
  pass?: number;
  order?: string[];
  speaker?: string | null;
  voted?: string[];
  my_vote?: string | null;
  escaped?: { round: number; top: string | null } | null;
  outcome?: { caught: boolean; top: string | null; impostors: string[]; tally: { name: string; votes: number }[] } | null;
};

export const DIFFICULTY_LABEL: Record<string, string> = { easy: "Fácil", medium: "Intermedio", hard: "Difícil", expert: "Experto", mixed: "Mixta" };

const headers = (token?: string | null): Record<string, string> => ({
  Accept: "application/json",
  "Content-Type": "application/json",
  "X-Requested-With": "XMLHttpRequest",
  "X-CSRF-TOKEN": csrf(),
  ...(token ? { "X-Game-Token": token } : {}),
});

export type Reply<T> = T & { error?: string; status?: number };

async function read<T>(res: Response): Promise<Reply<T>> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ...data, error: data.error || data.message || "No se pudo completar. Revisa tu conexión.", status: res.status };
  }
  return data;
}

export async function getJson<T>(url: string, token?: string | null): Promise<Reply<T>> {
  try {
    return await read<T>(await fetch(url, { headers: headers(token), cache: "no-store" }));
  } catch {
    return { error: "Sin conexión. Reintentando…", status: 0 } as Reply<T>;
  }
}

export async function postJson<T>(url: string, body: Record<string, unknown>, token?: string | null): Promise<Reply<T>> {
  try {
    return await read<T>(await fetch(url, { method: "POST", headers: headers(token), body: JSON.stringify(body) }));
  } catch {
    return { error: "Sin conexión. Inténtalo otra vez.", status: 0 } as Reply<T>;
  }
}

export function query(params: Record<string, string | number | string[]>) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (Array.isArray(value)) value.forEach((item) => search.append(`${key}[]`, item));
    else search.set(key, String(value));
  });
  return search.toString();
}

const roomKey = (code: string) => `zoe-room-${code.toUpperCase()}`;

export const roomToken = {
  get: (code: string) => (typeof window === "undefined" ? null : window.localStorage.getItem(roomKey(code))),
  set: (code: string, token: string) => window.localStorage.setItem(roomKey(code), token),
  forget: (code: string) => window.localStorage.removeItem(roomKey(code)),
};

const NAME_KEY = "zoe-player-name";

export const playerName = {
  get: () => (typeof window === "undefined" ? "" : window.localStorage.getItem(NAME_KEY) || ""),
  set: (name: string) => window.localStorage.setItem(NAME_KEY, name.trim()),
};

export function shuffle<T>(items: T[]): T[] {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

/** Local LINGOBIBLE progress: best score, stars and XP of each lesson, kept on this device. */
export type LessonProgress = { best: number; stars: number; xp: number };

const LINGO_KEY = "zoe-lingobible";

export const lingoProgress = {
  all(): Record<string, LessonProgress> {
    if (typeof window === "undefined") return {};
    try {
      return JSON.parse(window.localStorage.getItem(LINGO_KEY) || "{}");
    } catch {
      return {};
    }
  },
  save(lesson: string, score: number, xp: number) {
    const all = lingoProgress.all();
    const stars = score >= 90 ? 3 : score >= 70 ? 2 : score >= 40 ? 1 : 0;
    const previous = all[lesson];
    all[lesson] = {
      best: Math.max(previous?.best ?? 0, score),
      stars: Math.max(previous?.stars ?? 0, stars),
      xp: Math.max(previous?.xp ?? 0, score >= 70 ? xp : 0),
    };
    window.localStorage.setItem(LINGO_KEY, JSON.stringify(all));
    return { stars, passed: score >= 70 };
  },
  passed: (progress?: LessonProgress) => Boolean(progress && (progress.best >= 70 || progress.stars >= 2)),
};
