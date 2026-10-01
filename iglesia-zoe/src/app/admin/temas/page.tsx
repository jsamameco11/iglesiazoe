import { deleteTheme, uploadTheme } from "@/app/actions/admin";
import { getSession } from "@/lib/session";

export default async function ThemesAdmin() {
  const { supabase } = await getSession();
  const { data } = await supabase.from("themes").select("*").eq("active", true).order("theme_date", { ascending: false });
  return (
    <div>
      <h1 className="display text-4xl">Temas de célula</h1>
      <form action={uploadTheme} className="mt-6 grid gap-3 rounded-[1.5rem] border border-line bg-card p-5 md:grid-cols-2">
        <input name="title" required placeholder="Título del tema" className="rounded-xl border border-line px-3 py-2 md:col-span-2" />
        <input name="audience" defaultValue="Iglesia" placeholder="Dirigido a" className="rounded-xl border border-line px-3 py-2" />
        <input name="theme_date" type="date" required className="rounded-xl border border-line px-3 py-2" />
        <label className="text-sm md:col-span-2">PDF o material<input name="file" type="file" accept="application/pdf,image/*" className="mt-1 block" /></label>
        <button className="w-fit rounded-full bg-orange px-5 py-2 text-sm text-white">Publicar tema</button>
      </form>
      <div className="mt-6 overflow-hidden rounded-2xl border border-line bg-card">
        <table className="w-full text-sm">
          <thead className="bg-orange text-left text-white"><tr><th className="px-4 py-3">Fecha</th><th className="px-4 py-3">Tema</th><th className="px-4 py-3">Dirigido</th><th className="px-4 py-3">Archivo</th><th /></tr></thead>
          <tbody>
            {(data || []).map((theme) => (
              <tr key={theme.id} className="border-t border-line">
                <td className="px-4 py-3">{theme.theme_date}</td>
                <td className="px-4 py-3">{theme.title}</td>
                <td className="px-4 py-3">{theme.audience}</td>
                <td className="px-4 py-3">{theme.file_path ? "PDF" : "Sin archivo"}</td>
                <td className="px-4 py-3"><form action={deleteTheme.bind(null, theme.id)}><button className="text-red-700">Ocultar</button></form></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
