import { saveCapabilities } from "@/app/actions/admin";
import { capabilityCatalog, getCapabilities, isSuperadmin } from "@/lib/access";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";

export default async function AccessAdmin() {
  const { supabase, profile } = await getSession();
  if (!isSuperadmin(profile?.role)) redirect("/admin");
  const stored = await getCapabilities(supabase, "admin");

  return (
    <div className="mx-auto max-w-3xl pb-16">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted">Superadministrador</p>
      <h1 className="mt-3 text-4xl font-medium tracking-[-0.04em] md:text-5xl">Accesos del administrador</h1>
      <p className="mt-4 max-w-2xl text-sm leading-7 text-muted">
        El administrador entra al mismo panel. Tú decides qué puede operar. Los montos de ofrenda y diezmo permanecen ocultos salvo que actives esa opción.
      </p>
      <form action={saveCapabilities} className="mt-10 divide-y divide-line overflow-hidden rounded-[1.6rem] border border-line bg-card">
        {capabilityCatalog.map((item) => (
          <label key={item.key} className="flex items-start justify-between gap-6 px-6 py-5">
            <span>
              <span className="block text-base font-medium tracking-[-0.02em]">{item.title}</span>
              <span className="mt-1 block max-w-xl text-sm leading-6 text-muted">{item.text}</span>
            </span>
            <input
              type="checkbox"
              name={item.key}
              defaultChecked={stored[item.key]}
              className="mt-1 h-5 w-5 accent-ink"
            />
          </label>
        ))}
        <div className="flex justify-end bg-[#f7f4ee] px-6 py-4">
          <button className="rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white">Guardar accesos</button>
        </div>
      </form>
    </div>
  );
}
