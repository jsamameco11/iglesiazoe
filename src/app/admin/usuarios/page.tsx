import { createLeader, resetPassword } from "@/app/actions/admin";
import { isSuperadmin } from "@/lib/access";
import { getSession } from "@/lib/session";

const roles = [
  ["cell_leader", "Líder de célula"],
  ["red_leader", "Líder de red"],
];

export default async function UsersAdmin() {
  const { supabase, profile } = await getSession();
  const superadmin = isSuperadmin(profile?.role);
  const availableRoles = superadmin ? [...roles, ["admin", "Administrador"]] : roles;
  const { data: profiles } = await supabase.from("profiles").select("*, networks(code)").order("username");
  const letters = "ABCDEFGHIJKL".split("");
  return (
    <div>
      <h1 className="display text-4xl">Usuarios</h1>
      <form action={createLeader} className="mt-6 grid gap-3 rounded-[1.5rem] border border-line bg-card p-5 md:grid-cols-2">
        <input name="full_name" placeholder="Nombre" className="rounded-xl border border-line px-3 py-2" />
        <input name="username" placeholder="Usuario" required className="rounded-xl border border-line px-3 py-2" />
        <input name="password" type="password" placeholder="Clave" required className="rounded-xl border border-line px-3 py-2" />
        <select name="role" className="rounded-xl border border-line px-3 py-2">
          {availableRoles.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <select name="network_code" className="rounded-xl border border-line px-3 py-2">
          <option value="">Sin red</option>
          {letters.map((letter) => <option key={letter}>{letter}</option>)}
        </select>
        <input name="cell_codes" placeholder="Células, separadas por coma: 05G, 01G" className="rounded-xl border border-line px-3 py-2" />
        <button className="w-fit rounded-full bg-ink px-5 py-2 text-sm text-white">Crear usuario</button>
      </form>
      <div className="mt-6 overflow-hidden rounded-2xl border border-line bg-card">
        <table className="w-full text-sm">
          <thead><tr className="text-left"><th className="px-4 py-3">Usuario</th><th className="px-4 py-3">Nombre</th><th className="px-4 py-3">Rol</th><th className="px-4 py-3">Red</th><th className="px-4 py-3">Nueva clave</th></tr></thead>
          <tbody>
            {(profiles || []).map((profile) => (
              <tr key={profile.id} className="border-t border-line">
                <td className="px-4 py-3">{profile.username}</td>
                <td className="px-4 py-3">{profile.full_name}</td>
                <td className="px-4 py-3">{profile.role}</td>
                <td className="px-4 py-3">{(profile.networks as { code?: string } | null)?.code || "—"}</td>
                <td className="px-4 py-3">
                  <form action={resetPassword} className="flex gap-2">
                    <input type="hidden" name="user_id" value={profile.id} />
                    <input name="password" type="password" placeholder="Nueva clave" className="w-32 rounded-lg border border-line px-2 py-1" />
                    <button className="text-sm">Cambiar</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
