import { resolveMedia, readOverrides, type ResolvedMedia } from "./media";
import { createClient } from "./supabase/server";

export async function getSiteMedia(): Promise<ResolvedMedia> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from("site_settings").select("value").eq("key", "media").maybeSingle();
    if (error || !data?.value) return resolveMedia({});
    return resolveMedia(readOverrides(data.value));
  } catch {
    return resolveMedia({});
  }
}
