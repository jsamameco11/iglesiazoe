import { Link, usePage } from "@inertiajs/react";
import { useActionState } from "react";
import { blankDefaults, CopyFields, type CopyGroup } from "@/Components/admin/copy-fields";
import { MediaSlotCard, type AdminMediaSlot } from "@/Components/admin/media-manager";
import { can, usePanelUser } from "@/lib/access";
import { saveTexts, type ActionResult } from "@/lib/actions";
import { copyGroups } from "@/lib/copy";
import type { DesignPage } from "@/lib/design";
import { fallbackForSlot, mediaCatalog, type MediaAsset } from "@/lib/media";
import type { Ministry, SiteSettings } from "@/lib/types";
import { Group } from "./fields";

type Match = (id: string) => boolean;

const only = (...ids: string[]): Match => (id) => ids.includes(id);
const starts = (prefix: string, ...ids: string[]): Match => (id) => id.startsWith(prefix) || ids.includes(id);

/** Photo and video slots and text groups shown on each editable page. */
const pageContent: Record<string, { media?: Match; copy: string[] }> = {
  Home: { media: only("hero", "home-cells"), copy: ["home"] },
  About: { media: starts("about-"), copy: ["about"] },
  Ministries: { media: starts("ministry:"), copy: ["ministries"] },
  Ministry: { media: starts("ministry:"), copy: ["ministries"] },
  Visit: { media: only("visit"), copy: ["visit", "forms"] },
  Baptisms: { media: starts("baptism-", "baptism"), copy: ["baptism", "forms"] },
  Sermons: { media: only("sermons"), copy: ["sermons"] },
  Teachings: { media: only("teachings"), copy: ["teachings"] },
  Events: { media: only("events"), copy: ["events"] },
  Galleries: { media: only("gallery"), copy: ["gallery"] },
  Gallery: { copy: ["gallery"] },
  Devotionals: { media: only("devotionals"), copy: ["devotionals"] },
  Devotional: { media: only("devotionals"), copy: ["devotionals"] },
  Serve: { media: only("serve-cover"), copy: ["serve", "forms"] },
  ServeArea: { copy: ["serve", "forms"] },
  ServerRoute: { media: starts("route-"), copy: ["route"] },
  Radio: { media: only("radio"), copy: ["radio"] },
  Give: { media: only("giving"), copy: ["give"] },
  Contact: { media: only("contact"), copy: ["contact", "forms"] },
  Acceso: { copy: ["acceso"] },
  "Estudios/Acceso": { copy: ["acceso"] },
  AccesoAdmin: { copy: ["panel"] },
};

const everyPage = ["nav"];

/** Photos, videos and texts of the page shown in the preview, published on the spot. */
export function ContentPanel({ page, mediaOverrides, onSaved }: { page: DesignPage; mediaOverrides: Record<string, MediaAsset>; onSaved: () => void }) {
  const user = usePanelUser();
  const { settings, ministries } = usePage<{ settings: SiteSettings; ministries: Ministry[] }>().props;
  const content = pageContent[page.key] ?? { copy: [] };
  const slots: AdminMediaSlot[] = content.media
    ? mediaCatalog(ministries)
        .filter((slot) => content.media?.(slot.id))
        .map((slot) => ({ ...slot, asset: mediaOverrides[slot.id] ?? fallbackForSlot(slot.id, ministries), custom: Boolean(mediaOverrides[slot.id]) }))
    : [];
  const pick = (ids: string[]) => ids.map((id) => copyGroups.find((group) => group.id === id)).filter((group): group is CopyGroup => Boolean(group));
  const own = pick(content.copy);
  const shared = pick(everyPage);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-ink">Contenido de «{page.label}»</h3>
        <p className="mt-0.5 text-xs leading-5 text-muted">Fotos, videos, GIF y textos de esta página. Se publican al guardar cada uno y la vista previa se actualiza sola.</p>
      </div>

      {can(user, "media.manage") && (
        <Group title="Fotos, videos y GIF" text={slots.length ? `${slots.length} ${slots.length === 1 ? "espacio" : "espacios"} en esta página` : "Esta página no tiene fotos propias"} open={slots.length > 0}>
          {slots.length ? slots.map((slot) => <MediaSlotCard key={slot.id} slot={slot} compact onSaved={onSaved} />) : <p className="text-xs leading-5 text-muted">Sus imágenes salen de cada publicación (eventos, galerías, devocionales o áreas). Para un fondo propio usa la pestaña Página → Fondo de pantalla.</p>}
        </Group>
      )}

      {can(user, "content.manage") && (
        <>
          {own.map((group) => <CopyGroupForm key={group.id} group={group} settings={settings} open onSaved={onSaved} />)}
          {shared.map((group) => <CopyGroupForm key={group.id} group={group} settings={settings} onSaved={onSaved} />)}
          <Link href="/admin/contenido" className="block rounded-2xl border border-line bg-white px-4 py-3 text-sm font-semibold transition hover:border-ink/30">Títulos principales de cada página →</Link>
        </>
      )}

      {!can(user, "media.manage", "content.manage") && <p className="rounded-xl bg-white px-3 py-2.5 text-xs text-muted">Tu cuenta solo cambia el diseño. Pide el permiso de «Imágenes y videos» o «Textos y secciones» para editar el contenido.</p>}
    </div>
  );
}

function CopyGroupForm({ group, settings, open = false, onSaved }: { group: CopyGroup; settings: SiteSettings; open?: boolean; onSaved: () => void }) {
  const [state, action, pending] = useActionState(async (_: ActionResult | undefined, formData: FormData) => {
    const result = await saveTexts(blankDefaults(formData, [group]));
    if (result.ok) onSaved();
    return result;
  }, undefined);

  return (
    <Group title={`Textos · ${group.title}`} text={"note" in group && group.note ? group.note : `${group.entries.length} textos. Si borras uno, vuelve al original.`} open={open}>
      <form action={action} className="space-y-4">
        <CopyFields settings={settings} group={group} columns={false} />
        {state?.ok && <p className="rounded-xl bg-sage px-3 py-2 text-sm">Textos publicados.</p>}
        {state?.error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
        <button disabled={pending} className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{pending ? "Publicando…" : "Publicar textos"}</button>
      </form>
    </Group>
  );
}
