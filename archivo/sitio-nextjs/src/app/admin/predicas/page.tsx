import { deleteSermon, saveSermon } from "@/app/actions/admin";
import { getSession } from "@/lib/session";

export default async function SermonsAdmin() {
  const { supabase } = await getSession();
  const { data } = await supabase.from("sermons").select("*").order("sermon_date", { ascending: false });
  return (
    <div>
      <h1 className="display text-4xl">Prédicas</h1>
      <form action={saveSermon} className="mt-6 grid gap-3 rounded-[1.5rem] border border-line bg-card p-5 md:grid-cols-2">
        <input name="title" placeholder="Título" required className="rounded-xl border border-line px-3 py-2" />
        <input name="preacher" placeholder="Predicador" className="rounded-xl border border-line px-3 py-2" />
        <input name="series" placeholder="Serie" className="rounded-xl border border-line px-3 py-2" />
        <input name="sermon_date" type="date" className="rounded-xl border border-line px-3 py-2" />
        <input name="youtube_id" placeholder="ID de YouTube" className="rounded-xl border border-line px-3 py-2" />
        <label className="text-sm"><input type="checkbox" name="is_live" /> Marcar como transmisión principal</label>
        <label className="text-sm"><input type="checkbox" name="published" defaultChecked /> Publicada</label>
        <button className="w-fit rounded-full bg-ink px-5 py-2 text-sm text-white">Agregar</button>
      </form>
      <div className="mt-6 space-y-3">
        {(data || []).map((sermon) => (
          <form key={sermon.id} action={saveSermon} className="grid gap-3 rounded-2xl border border-line bg-card p-4 md:grid-cols-2">
            <input type="hidden" name="id" value={sermon.id} />
            <input name="title" defaultValue={sermon.title} className="rounded-xl border border-line px-3 py-2" />
            <input name="preacher" defaultValue={sermon.preacher || ""} className="rounded-xl border border-line px-3 py-2" />
            <input name="series" defaultValue={sermon.series || ""} className="rounded-xl border border-line px-3 py-2" />
            <input name="sermon_date" type="date" defaultValue={sermon.sermon_date || ""} className="rounded-xl border border-line px-3 py-2" />
            <input name="youtube_id" defaultValue={sermon.youtube_id || ""} className="rounded-xl border border-line px-3 py-2" />
            <label className="text-sm"><input type="checkbox" name="is_live" defaultChecked={sermon.is_live} /> En vivo</label>
            <label className="text-sm"><input type="checkbox" name="published" defaultChecked={sermon.published} /> Publicada</label>
            <div className="flex gap-3">
              <button className="rounded-full bg-ink px-4 py-2 text-sm text-white">Guardar</button>
              <button formAction={deleteSermon.bind(null, sermon.id)} className="text-sm text-red-700">Eliminar</button>
            </div>
          </form>
        ))}
      </div>
    </div>
  );
}
