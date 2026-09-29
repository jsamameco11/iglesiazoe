import { ThemeBrowser } from "@/components/portal/theme-browser";
import { getSession } from "@/lib/session";
import type { Theme } from "@/lib/types";

export default async function TemasPage() {
  const { supabase } = await getSession();
  const { data } = await supabase.from("themes").select("*").eq("active", true).order("theme_date", { ascending: false });
  return (
    <div>
      <h1 className="display text-4xl">Temas</h1>
      <p className="mt-2 mb-6 text-muted">Material de célula publicado por el administrador.</p>
      <ThemeBrowser themes={(data || []) as Theme[]} />
    </div>
  );
}
