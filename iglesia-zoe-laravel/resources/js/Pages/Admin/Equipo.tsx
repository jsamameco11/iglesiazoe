import { useMemo, useState } from "react";
import AdminLayout from "@/Layouts/AdminLayout";
import { Notice, PageHeader, Panel, button, ghost, input, useAction } from "@/Components/admin/ui";
import { send } from "@/lib/actions";
import type { AdminType, Catalog, Permission } from "@/lib/access";

type Account = {
  id: string;
  name: string;
  username: string;
  superadmin: boolean;
  types: AdminType[];
  permissions: Permission[];
  network_code: string | null;
  cells: string[];
  serve_areas: string[];
  area: string | null;
  active: boolean;
  label: string;
  created_at: string | null;
};

type ServeArea = { id: string; name: string; active: boolean };

type Props = { catalog: Catalog; networks: { id: string; code: string }[]; cells: string[]; meId: string; serveAreas: ServeArea[]; accounts: Account[] };

const typeTone: Record<AdminType, string> = {
  red: "bg-sky text-[#28516b]",
  visuales: "bg-blush text-[#8a4a33]",
  celula: "bg-mist text-[#3d6248]",
  director: "bg-clay text-clay-deep",
  atmosfera: "bg-amber/60 text-[#7a5418]",
  voluntarios: "bg-sage text-[#4b4a2c]",
  temas: "bg-orange/15 text-orange-deep",
  estudios: "bg-sky text-[#28516b]",
};

export default function Equipo({ catalog, networks, cells, meId, serveAreas, accounts }: Props) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<AdminType | "all">("all");
  const list = accounts.filter((account) => {
    const text = `${account.name} ${account.username} ${account.network_code ?? ""}`.toLowerCase();
    return text.includes(query.toLowerCase()) && (filter === "all" || account.types.includes(filter));
  });

  return (
    <AdminLayout>
      <div className="pb-16">
        <PageHeader
          kicker="Superadmi"
          title="Equipo y accesos"
          text="Crea administradores, elige su tipo (puede ser híbrido) y ajusta cada función. Los cambios se aplican en cuanto guardas."
          aside={<div className="rounded-2xl border border-line bg-white px-5 py-3 text-right"><p className="text-2xl font-semibold">{accounts.length}</p><p className="text-[11px] uppercase tracking-wider text-muted">cuentas</p></div>}
        />
        <div className="mt-7 grid gap-6 2xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
          <CreateAccount catalog={catalog} networks={networks} cells={cells} serveAreas={serveAreas} />
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nombre, usuario o red" className={`${input} mt-0 max-w-xs`} />
              {(["all", ...catalog.types.map((type) => type.key)] as const).map((key) => (
                <button key={key} type="button" onClick={() => setFilter(key)} className={`rounded-full px-3.5 py-2 text-xs font-semibold transition ${filter === key ? "bg-ink text-white" : "bg-white text-muted hover:text-ink"}`}>
                  {key === "all" ? "Todos" : catalog.types.find((type) => type.key === key)?.label}
                </button>
              ))}
            </div>
            {list.map((account) => <AccountCard key={account.id} account={account} catalog={catalog} networks={networks} serveAreas={serveAreas} isMe={account.id === meId} />)}
            {!list.length && <p className="rounded-2xl border border-dashed border-line px-5 py-10 text-center text-sm text-muted">No hay cuentas con ese filtro.</p>}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

function CreateAccount({ catalog, networks, cells, serveAreas }: { catalog: Catalog; networks: { code: string }[]; cells: string[]; serveAreas: ServeArea[] }) {
  const [types, setTypes] = useState<AdminType[]>(["red"]);
  const [permissions, setPermissions] = useState<Permission[]>(() => withTypes(catalog, [], catalog.defaults, ["red"]));
  const [areas, setAreas] = useState<string[]>([]);
  const { result, setResult, pending, run } = useAction();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    types.forEach((type) => data.append("types[]", type));
    permissions.forEach((permission) => data.append("permissions[]", permission));
    areas.forEach((area) => data.append("serve_areas[]", area));
    run(() => send("/admin/equipo", data), () => {
      form.reset();
      setTypes(["red"]);
      setPermissions(withTypes(catalog, [], catalog.defaults, ["red"]));
      setAreas([]);
    });
  }

  return (
    <Panel title="Nueva cuenta" text="Elige el tipo: los servidores ingresan por la web de la iglesia y los administradores por el panel admi." className="self-start">
      <form onSubmit={submit} className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-xs font-semibold text-muted">Nombre completo<input name="name" required className={input} placeholder="Ej. María Torres" /></label>
          <label className="text-xs font-semibold text-muted">Usuario o DNI<input name="username" required className={input} placeholder="maria.torres" autoComplete="off" /></label>
          <label className="text-xs font-semibold text-muted">Clave inicial<input name="password" type="text" required minLength={6} className={input} placeholder="Mínimo 6 caracteres" autoComplete="new-password" /></label>
        </div>
        <AccessEditor catalog={catalog} types={types} permissions={permissions} onChange={(nextTypes, nextPermissions) => { setTypes(nextTypes); setPermissions(nextPermissions); }} />
        {types.includes("director") && <DirectorArea serveAreas={serveAreas} />}
        {permissions.includes("inbox.serve") && <ServeAreaPicker areas={serveAreas} value={areas} onChange={setAreas} />}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-semibold text-muted">Red (opcional)
            <select name="network_code" className={input} defaultValue="">
              <option value="">Sin red · ve todas</option>
              {networks.map((network) => <option key={network.code} value={network.code}>Red {network.code}</option>)}
            </select>
          </label>
          <label className="text-xs font-semibold text-muted">Células a cargo (opcional)
            <input name="cells" list="zoe-cells" className={input} placeholder="01A, 0101A" />
            <datalist id="zoe-cells">{cells.map((code) => <option key={code} value={code} />)}</datalist>
          </label>
        </div>
        <Notice result={result} onClose={() => setResult(null)} />
        <button disabled={pending} className={button}>{pending ? "Creando…" : "Crear cuenta"}</button>
      </form>
    </Panel>
  );
}

function AccountCard({ account, catalog, networks, serveAreas, isMe }: { account: Account; catalog: Catalog; networks: { code: string }[]; serveAreas: ServeArea[]; isMe: boolean }) {
  const [mode, setMode] = useState<"view" | "edit" | "password">("view");
  const [types, setTypes] = useState(account.types);
  const [permissions, setPermissions] = useState(account.permissions);
  const [areas, setAreas] = useState(account.serve_areas);
  const { result, setResult, pending, run } = useAction();
  const titles = useMemo(() => Object.fromEntries(catalog.permissions.map((item) => [item.key, item.title])), [catalog]);
  const areaNames = account.serve_areas.map((id) => serveAreas.find((area) => area.id === id)?.name ?? "Área eliminada");

  function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    data.set("id", account.id);
    types.forEach((type) => data.append("types[]", type));
    permissions.forEach((permission) => data.append("permissions[]", permission));
    areas.forEach((area) => data.append("serve_areas[]", area));
    run(() => send("/admin/equipo/actualizar", data), () => setMode("view"));
  }

  function password(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    data.set("id", account.id);
    run(() => send("/admin/equipo/clave", data), () => setMode("view"));
  }

  function remove() {
    if (!window.confirm(`¿Eliminar la cuenta ${account.username}? Sus informes y gastos se conservan.`)) return;
    run(() => send("/admin/equipo/eliminar", { id: account.id }));
  }

  return (
    <article className={`rounded-[1.5rem] border bg-card p-5 transition ${account.active ? "border-line" : "border-dashed border-line opacity-70"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold tracking-[-0.02em]">{account.name}</h3>
            {account.superadmin && <span className="rounded-full bg-ink px-2.5 py-1 text-[10.5px] font-semibold text-white">SUPERADMI</span>}
            {account.types.map((type) => (
              <span key={type} className={`rounded-full px-2.5 py-1 text-[10.5px] font-semibold ${typeTone[type]}`}>
                {catalog.types.find((item) => item.key === type)?.label}
                {type === "director" && account.area ? ` · ${account.area}` : ""}
              </span>
            ))}
            {!account.active && <span className="rounded-full bg-red-50 px-2.5 py-1 text-[10.5px] font-semibold text-red-700">Desactivada</span>}
          </div>
          <p className="mt-1 text-xs text-muted">
            Usuario <strong className="font-semibold text-ink">{account.username}</strong>
            {account.network_code ? ` · Red ${account.network_code}` : ""}
            {account.cells.length ? ` · Células ${account.cells.join(", ")}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!account.superadmin && <button type="button" onClick={() => setMode(mode === "edit" ? "view" : "edit")} className={ghost}>{mode === "edit" ? "Cancelar" : "Editar accesos"}</button>}
          <button type="button" onClick={() => setMode(mode === "password" ? "view" : "password")} className={ghost}>Clave</button>
          {!account.superadmin && !isMe && <button type="button" onClick={remove} disabled={pending} className="rounded-full px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50">Eliminar</button>}
        </div>
      </div>
      {mode === "view" && !account.superadmin && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {account.permissions.map((permission) => (
            <span key={permission} className="rounded-full bg-paper px-2.5 py-1 text-[11px] text-muted">
              {titles[permission]}
              {permission === "inbox.serve" && <strong className="font-semibold text-ink"> · {areaNames.length ? areaNames.join(", ") : "todas las áreas"}</strong>}
            </span>
          ))}
          {!account.permissions.length && <span className="text-xs text-muted">Sin funciones asignadas.</span>}
        </div>
      )}
      {mode === "edit" && (
        <form onSubmit={save} className="mt-5 space-y-4 border-t border-line pt-5">
          <label className="block text-xs font-semibold text-muted">Nombre<input name="name" defaultValue={account.name} className={input} /></label>
          <AccessEditor catalog={catalog} types={types} permissions={permissions} onChange={(nextTypes, nextPermissions) => { setTypes(nextTypes); setPermissions(nextPermissions); }} />
          {types.includes("director") && <DirectorArea serveAreas={serveAreas} defaultValue={account.area ?? ""} />}
          {permissions.includes("inbox.serve") && <ServeAreaPicker areas={serveAreas} value={areas} onChange={setAreas} />}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-semibold text-muted">Red
              <select name="network_code" defaultValue={account.network_code ?? ""} className={input}>
                <option value="">Sin red · ve todas</option>
                {networks.map((network) => <option key={network.code} value={network.code}>Red {network.code}</option>)}
              </select>
            </label>
            <label className="text-xs font-semibold text-muted">Células a cargo<input name="cells" defaultValue={account.cells.join(", ")} list="zoe-cells" className={input} /></label>
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="active" value="1" defaultChecked={account.active} className="h-4 w-4 accent-ink" /> Cuenta activa (si la desactivas no podrá ingresar)</label>
          <button disabled={pending} className={button}>{pending ? "Guardando…" : "Guardar accesos"}</button>
        </form>
      )}
      {mode === "password" && (
        <form onSubmit={password} className="mt-5 flex flex-wrap items-end gap-3 border-t border-line pt-5">
          <label className="min-w-56 flex-1 text-xs font-semibold text-muted">Nueva clave<input name="password" type="text" minLength={6} required className={input} autoComplete="new-password" /></label>
          <button disabled={pending} className={button}>Cambiar clave</button>
        </form>
      )}
      <div className="mt-3"><Notice result={result} onClose={() => setResult(null)} /></div>
    </article>
  );
}

function ServeAreaPicker({ areas, value, onChange }: { areas: ServeArea[]; value: string[]; onChange: (value: string[]) => void }) {
  const all = value.length === 0;
  const chip = (on: boolean) => `rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${on ? "border-ink bg-ink text-white" : "border-line bg-white text-muted hover:border-ink/30 hover:text-ink"}`;
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((item) => item !== id) : [...value, id]);

  return (
    <div className="rounded-2xl border border-line bg-white p-4">
      <p className="text-xs font-semibold text-muted">«Quiero servir» · áreas que recibe en su pestaña y en sus notificaciones</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={() => onChange([])} className={chip(all)} aria-pressed={all}>Todas las áreas</button>
        {areas.map((area) => (
          <button key={area.id} type="button" onClick={() => toggle(area.id)} className={chip(value.includes(area.id))} aria-pressed={value.includes(area.id)}>
            {area.name}
            {!area.active && <span className="ml-1 font-normal opacity-70">(oculta)</span>}
          </button>
        ))}
      </div>
      <p className="mt-2 text-[11.5px] leading-4 text-muted">
        {all ? "Recibe a todas las personas que se inscriben, de cualquier área." : "Solo verá y recibirá notificaciones de las áreas marcadas, por ejemplo el líder de Música solo de Música."}
      </p>
    </div>
  );
}

function DirectorArea({ serveAreas, defaultValue = "" }: { serveAreas: ServeArea[]; defaultValue?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-4">
      <label className="block text-xs font-semibold text-muted">
        Área que dirige
        <input name="area" defaultValue={defaultValue} maxLength={80} list="zoe-director-areas" className={input} placeholder="Ej. Alabanza, Niños, Multimedia" autoComplete="off" />
      </label>
      <datalist id="zoe-director-areas">{serveAreas.map((area) => <option key={area.id} value={area.name} />)}</datalist>
      <p className="mt-2 text-[11.5px] leading-4 text-muted">Aparece junto a su cargo: «Director de Área · Alabanza». Sus funciones son solo las que marques arriba.</p>
    </div>
  );
}

/** A cell server (Base, hijo or subhijo) alone never opens servers. */
function cellServerOnly(types: AdminType[]) {
  return types.length === 1 && types[0] === "celula";
}

function exclusiveType(catalog: Catalog, types: AdminType[]) {
  return types.length === 1 ? catalog.types.find((item) => item.key === types[0] && item.exclusive) : undefined;
}

function withTypes(catalog: Catalog, previousTypes: AdminType[], current: Permission[], nextTypes: AdminType[]) {
  const exclusive = exclusiveType(catalog, nextTypes);
  if (exclusive) return [...exclusive.permissions];
  if (exclusiveType(catalog, previousTypes)) current = [...catalog.defaults];
  const fromTypes = (types: AdminType[]) => new Set(types.flatMap((type) => catalog.types.find((item) => item.key === type)?.permissions ?? []));
  const before = fromTypes(previousTypes);
  const after = fromTypes(nextTypes);
  const kept = current.filter((permission) => !before.has(permission) || after.has(permission) || catalog.defaults.includes(permission));
  const locked = cellServerOnly(nextTypes) ? catalog.networkOnly : [];
  return catalog.permissions.map((item) => item.key).filter((key) => (kept.includes(key) || after.has(key)) && !locked.includes(key));
}

function AccessEditor({
  catalog,
  types,
  permissions,
  onChange,
}: {
  catalog: Catalog;
  types: AdminType[];
  permissions: Permission[];
  onChange: (types: AdminType[], permissions: Permission[]) => void;
}) {
  const groups = [...new Set(catalog.permissions.map((item) => item.group))];
  const exclusive = exclusiveType(catalog, types);
  const locked = cellServerOnly(types) ? catalog.networkOnly : [];

  function toggleType(type: AdminType) {
    const isExclusive = catalog.types.some((item) => item.key === type && item.exclusive);
    let next: AdminType[];
    if (types.includes(type)) next = types.filter((item) => item !== type);
    else if (isExclusive) next = [type];
    else next = [...types.filter((item) => !catalog.types.some((entry) => entry.key === item && entry.exclusive)), type];
    onChange(next, withTypes(catalog, types, permissions, next));
  }

  function togglePermission(permission: Permission) {
    if (exclusive || locked.includes(permission)) return;
    onChange(types, permissions.includes(permission) ? permissions.filter((item) => item !== permission) : [...permissions, permission]);
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold text-muted">Tipo de cuenta · puedes combinar varios (excepto los de acceso único)</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {catalog.types.map((type) => {
            const on = types.includes(type.key);
            return (
              <button
                key={type.key}
                type="button"
                onClick={() => toggleType(type.key)}
                className={`rounded-2xl border p-3.5 text-left transition ${on ? "border-ink bg-ink text-white" : "border-line bg-white hover:border-ink/30"}`}
              >
                <span className="flex items-center justify-between gap-2 text-sm font-semibold">
                  {type.label}
                  <span className={`grid h-5 w-5 place-items-center rounded-full border text-[11px] ${on ? "border-white bg-white text-ink" : "border-line"}`}>{on ? "✓" : ""}</span>
                </span>
                <span className={`mt-1 block text-[11.5px] leading-4 ${on ? "text-white/70" : "text-muted"}`}>{type.text}</span>
                <span className={`mt-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${on ? "bg-white/15 text-white" : "bg-paper text-muted"}`}>
                  {type.server ? "Ingresa por la web de la iglesia" : "Ingresa por el panel admi"}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="rounded-2xl border border-line bg-white p-4">
        <p className="text-xs font-semibold text-muted">
          {exclusive
            ? `${exclusive.label} es un acceso único: solo tendrá esta función.`
            : locked.length
              ? "Funciones exactas · un servidor de célula (Base, hijo o subhijo) no crea servidores"
              : "Funciones exactas · ajusta lo que necesites"}
        </p>
        <div className={`mt-3 grid gap-4 md:grid-cols-3 ${exclusive ? "pointer-events-none opacity-60" : ""}`}>
          {groups.map((group) => (
            <div key={group}>
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-orange-deep">{group}</p>
              <div className="mt-2 space-y-1.5">
                {catalog.permissions.filter((item) => item.group === group).map((item) => {
                  const off = locked.includes(item.key);
                  return (
                    <label key={item.key} title={off ? "Los servidores de célula no crean servidores: solo el Servidor de Red y los administradores." : item.text} className={`flex items-start gap-2 text-[13px] leading-5 ${off ? "cursor-not-allowed opacity-45" : "cursor-pointer"}`}>
                      <input type="checkbox" checked={!off && permissions.includes(item.key)} disabled={off} onChange={() => togglePermission(item.key)} className="mt-0.5 h-4 w-4 shrink-0 accent-ink" />
                      <span>{item.title}{catalog.defaults.includes(item.key) && <span className="ml-1 text-[10px] text-muted">(por defecto)</span>}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
