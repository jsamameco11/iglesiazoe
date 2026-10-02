import { Link, usePage } from "@inertiajs/react";
import { useActionState, type ReactNode } from "react";
import { saveSettings, type ActionResult } from "@/lib/actions";
import AdminLayout from "@/Layouts/AdminLayout";
import { resolveMedia, ROUTE_SLOTS, type MediaAsset } from "@/lib/media";
import type { SectionItem, SiteSettings } from "@/lib/types";

const field = "mt-1 w-full rounded-xl border border-line bg-white px-3 py-2";

function bySlot(items: SectionItem[], slots: number) {
  return Array.from({ length: slots }, (_, index) => items.find((item) => item.slot === index + 1) ?? (items.some((item) => item.slot) ? undefined : items[index]));
}

function thumb(asset: MediaAsset) {
  return asset.kind === "video" ? asset.poster || "" : asset.src;
}

export default function Secciones({ settings, mediaOverrides }: { settings: SiteSettings; mediaOverrides: Record<string, MediaAsset> }) {
  const media = resolveMedia(mediaOverrides);

  return (
    <AdminLayout>
      <h1 className="display text-4xl">Encabezados y Ruta</h1>
      <p className="mt-2 max-w-2xl text-muted">
        Edita los títulos de Involúcrate, del carrusel del inicio, de Eventos y de Recursos, y los niveles de la Ruta del servidor. Las áreas de servicio, sus equipos y sus fotos se editan en{" "}
        <Link href="/admin/involucrate" className="underline underline-offset-4">Involúcrate · áreas</Link>.
      </p>

      <SectionForm title="Involúcrate y carrusel del inicio" page="/involucrate">
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Página Involúcrate</p>
            <TitleFields titleName="serveTitle" textName="serveText" title={settings.serveTitle} text={settings.serveText} />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Carrusel «iglesia en movimiento» (inicio)</p>
            <TitleFields titleName="serveRailTitle" textName="serveRailText" title={settings.serveRailTitle} text={settings.serveRailText} />
            <p className="mt-2 text-[11px] text-muted">Lo que escribas entre asteriscos se ve en cursiva, por ejemplo: *está en movimiento*.</p>
          </div>
        </div>
      </SectionForm>

      <SectionForm title="Ruta del servidor · niveles" page="/ruta-del-servidor">
        <TitleFields titleName="routeTitle" textName="routeText" title={settings.routeTitle} text={settings.routeText} />
        <ItemRows
          prefix="route"
          label="Nivel"
          items={bySlot(settings.routeLevels ?? [], ROUTE_SLOTS)}
          photo={(slot) => ({ src: thumb(media.route(slot)), href: `/admin/medios#medio-route-${slot}` })}
        />
      </SectionForm>

      <SectionForm title="Eventos y Recursos · encabezados">
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Página Eventos</p>
            <TitleFields titleName="eventsTitle" textName="eventsText" title={settings.eventsTitle} text={settings.eventsText} />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Página Recursos</p>
            <TitleFields titleName="teachingsTitle" textName="teachingsText" title={settings.teachingsTitle} text={settings.teachingsText} />
          </div>
        </div>
      </SectionForm>
    </AdminLayout>
  );
}

function SectionForm({ title, page, children }: { title: string; page?: string; children: ReactNode }) {
  const [state, action, pending] = useActionState(async (_: ActionResult | undefined, formData: FormData) => saveSettings(formData), undefined);
  const { entrance } = usePage().props as unknown as { entrance?: { siteUrl?: string } };
  const site = (entrance?.siteUrl || "").replace(/\/$/, "");
  return (
    <form action={action} className="mt-8 grid gap-5 rounded-[1.5rem] border border-line bg-card p-5 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-medium tracking-[-0.02em]">{title}</h2>
        {page ? <a href={`${site}${page}`} target="_blank" rel="noreferrer" className="text-sm text-muted underline-offset-4 hover:underline">Ver en la web ↗</a> : null}
      </div>
      {children}
      {state?.error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      {state?.ok && <p className="rounded-xl bg-sage px-3 py-2 text-sm">Guardado. Ya se ve en la web.</p>}
      <button disabled={pending} className="w-fit rounded-full bg-accent px-5 py-2 text-sm text-white disabled:opacity-60">{pending ? "Guardando…" : "Guardar cambios"}</button>
    </form>
  );
}

function TitleFields({ titleName, textName, title, text }: { titleName: string; textName: string; title: string; text: string }) {
  return (
    <div className="mt-2 grid gap-3">
      <label className="text-sm">Título<input name={titleName} defaultValue={title} maxLength={120} className={field} /></label>
      <label className="text-sm">Texto<textarea name={textName} defaultValue={text} rows={3} maxLength={400} className={field} /></label>
    </div>
  );
}

function ItemRows({
  prefix,
  label,
  items,
  photo,
}: {
  prefix: string;
  label: string;
  items: (SectionItem | undefined)[];
  photo: (slot: number) => { src: string; href: string };
}) {
  return (
    <ol className="grid gap-3">
      {items.map((item, index) => {
        const slot = index + 1;
        const image = photo(slot);
        return (
          <li key={slot} className="grid gap-3 rounded-2xl border border-line bg-white/70 p-3 sm:grid-cols-[88px_1fr]">
            <div className="flex gap-3 sm:block">
              <div className="aspect-square w-20 overflow-hidden rounded-xl bg-stone sm:w-[88px]">
                {image.src ? <img src={image.src} alt="" loading="lazy" className="h-full w-full object-cover" /> : null}
              </div>
              <Link href={image.href} className="mt-1.5 block text-[11px] text-muted underline-offset-2 hover:underline">Cambiar foto</Link>
            </div>
            <div className="grid gap-2">
              <label className="text-sm">
                {label} {slot}
                <input name={`${prefix}_title_${slot}`} defaultValue={item?.title ?? ""} maxLength={80} placeholder="Vacío = no se muestra" className={field} />
              </label>
              <textarea name={`${prefix}_text_${slot}`} defaultValue={item?.text ?? ""} rows={2} maxLength={400} aria-label={`Descripción de ${label.toLowerCase()} ${slot}`} placeholder="Descripción breve" className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm" />
            </div>
          </li>
        );
      })}
    </ol>
  );
}
