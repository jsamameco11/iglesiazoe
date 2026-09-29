import { defaultMinistries, defaultSettings } from "./defaults";
import { createClient } from "./supabase/server";
import type { Ministry, SiteSettings } from "./types";

export async function getSettings(): Promise<SiteSettings> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("site_settings")
      .select("value")
      .eq("key", "site")
      .maybeSingle();
    if (error || !data?.value) return defaultSettings;
    return { ...defaultSettings, ...(data.value as SiteSettings) };
  } catch {
    return defaultSettings;
  }
}

export async function getMinistries(): Promise<Ministry[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("ministries")
      .select("*")
      .eq("active", true)
      .order("sort_order");
    if (error || !data?.length) return defaultMinistries;
    return data as Ministry[];
  } catch {
    return defaultMinistries;
  }
}

export async function getSermons() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("sermons")
    .select("*")
    .eq("published", true)
    .order("sermon_date", { ascending: false });
  return data ?? [];
}

export async function getBaptismEvents() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("baptism_events")
    .select("*")
    .eq("active", true)
    .order("event_date", { ascending: true });
  return data ?? [];
}
