export type RouteStep = { id: string; name: string; summary: string | null; state: "done" | "current" | "next"; average: number | null };

export type Grade = { id: string; title: string; week: number | null; score: number | null };

export type Summary = { average: number | null; graded: number; total: number; pass_score: number; max_score: number };

export type Student = { name: string; first_name: string; username: string; status: string; status_label: string };
