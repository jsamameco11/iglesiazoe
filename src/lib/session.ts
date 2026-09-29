import { createClient } from "./supabase/server";
import type { Profile } from "./types";

export async function getSession() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, profile: null as Profile | null };

  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  return { supabase, user, profile: (data as Profile | null) ?? null };
}

export function leaderEmail(username: string) {
  const value = username.trim().toLowerCase();
  return value.includes("@") ? value : `${value}@lideres.iglesiacristianazoe.pe`;
}
