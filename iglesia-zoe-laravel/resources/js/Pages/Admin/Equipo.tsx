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
  active: boolean;
  label: string;
  created_at: string | null;
};

type Props = { catalog: Catalog; networks: { id: string; code: string }[]; cells: string[]; meId: string; accounts: Account[] };

const typeTone: Record<AdminType, string> = {
  red: "bg-sky text-[#28516b]",
  visuales: "bg-blush text-[#8a4a33]",
  celula: "bg-mist text-[#3d6248]",
  atmosfera: "bg-amber/60 text-[#7a5418]",
  temas: "bg-orange/15 text-orange-deep",
};

export default function Equipo({ catalog, networks, cells, meId, accounts }: Props) {
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
          <CreateAccount catalog={catalog} networks={networks} cells={cells} />
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nombre, usuario o red" className={`${input} mt-0 max-w-xs`} />
              {(["all", ...catalog.types.map((type) => type.key)] as const).map((key) => (
                <button key={key} type="button" onClick={() => setFilter(key)} className={`rounded-full px-3.5 py-2 text-xs font-semibold transition ${filter === key ? "bg-ink text-white" : "bg-white text-muted hover:text-ink"}`}>
                  {key === "all" ? "Todos" : catalog.types.find((type) => type.key === key)?.label}
                </button>
              ))}
            </div>
            {list.map((account) => <AccountCard key={account.id} account={account} catalog={catalog} networks={networks} isMe={account.id === meId} />)}
            {!list.length && <p className="rounded-2xl border border-dashed border-line px-5 py-10 text-center text-sm text-muted">No hay cuentas con ese filtro.</p>}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

function CreateAccount({ catalog, networks, cells }: { catalog: Catalog; networks: { code: string }[]; cells: string[] }) {
  const [types, setTypes] = useState<AdminType[]>(["red"]);
  const [permissions, setPermissions] = useState<Permission[]>(() => withTypes(catalog, [], catalog.defaults, ["red"]));
  const { result, setResult, pending, run } = useAction();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    types.forEach((type) => data.append("types[]", type));
    permissions.forEach((permission) => data.append("permissions[]", permission));
    run(() => send("/admin/equipo", data), () => {
      form.reset();
      setTypes(["red"]);
      setPermissions(withTypes(catalog, [], catalog.defaults, ["red"]));
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

function AccountCard({ account, catalog, networks, isMe }: { account: Account; catalog: Catalog; networks: { code: string }[]; isMe: boolean }) {
  const [mode, setMode] = useState<"view" | "edit" | "password">("view");
  const [types, setTypes] = useState(account.types);
  const [permissions, setPermissions] = useState(account.permissions);
  const { result, setResult, pending, run } = useAction();
  const titles = useMemo(() => Object.fromEntries(catalog.permissions.map((item) => [item.key, item.title])), [catalog]);

  function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    data.set("id", account.id);
    types.forEach((type) => data.append("types[]", type));
    permissions.forEach((permission) => data.append("permissions[]", permission));
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
              <span key={type} className={`rounded-full px-2.5 py-1 text-[10.5px] font-semibold ${typeTone[type]}`}>{catalog.types.find((item) => item.key === type)?.label}</span>
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
          {account.permissions.map((permission) => <span key={permission} className="rounded-full bg-paper px-2.5 py-1 text-[11px] text-muted">{titles[permission]}</span>)}
          {!account.permissions.length && <span className="text-xs text-muted">Sin funciones asignadas.</span>}
        </div>
      )}
      {mode === "edit" && (
        <form onSubmit={save} className="mt-5 space-y-4 border-t border-line pt-5">
          <label className="block text-xs font-semibold text-muted">Nombre<input name="name" defaultValue={account.name} className={input} /></label>
          <AccessEditor catalog={catalog} types={types} permissions={permissions} onChange={(nextTypes, nextPermissions) => { setTypes(nextTypes); setPermissions(nextPermissions); }} />
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
  return catalog.permissions.map((item) => item.key).filter((key) => kept.includes(key) || after.has(key));
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

  function toggleType(type: AdminType) {
    const isExclusive = catalog.types.some((item) => item.key === type && item.exclusive);
    let next: AdminType[];
    if (types.includes(type)) next = types.filter((item) => item !== type);
    else if (isExclusive) next = [type];
    else next = [...types.filter((item) => !catalog.types.some((entry) => entry.key === item && entry.exclusive)), type];
    onChange(next, withTypes(catalog, types, permissions, next));
  }

  function togglePermission(permission: Permission) {
    if (exclusive) return;
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
          {exclusive ? `${exclusive.label} es un acceso único: solo tendrá esta función.` : "Funciones exactas · ajusta lo que necesites"}
        </p>
        <div className={`mt-3 grid gap-4 md:grid-cols-3 ${exclusive ? "pointer-events-none opacity-60" : ""}`}>
          {groups.map((group) => (
            <div key={group}>
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-orange-deep">{group}</p>
              <div className="mt-2 space-y-1.5">
                {catalog.permissions.filter((item) => item.group === group).map((item) => (
                  <label key={item.key} title={item.text} className="flex cursor-pointer items-start gap-2 text-[13px] leading-5">
                    <input type="checkbox" checked={permissions.includes(item.key)} onChange={() => togglePermission(item.key)} className="mt-0.5 h-4 w-4 shrink-0 accent-ink" />
                    <span>{item.title}{catalog.defaults.includes(item.key) && <span className="ml-1 text-[10px] text-muted">(por defecto)</span>}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
