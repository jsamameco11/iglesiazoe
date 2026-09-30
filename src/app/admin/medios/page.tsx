import { redirect } from "next/navigation";
import { MediaManager, type AdminMediaSlot } from "@/components/admin/media-manager";
import { getCapabilities, isSuperadmin } from "@/lib/access";
import { defaultMinistries } from "@/lib/defaults";
import { fallbackForSlot, mediaCatalog } from "@/lib/media";
import { getSiteMedia } from "@/lib/media-server";
import { getSession } from "@/lib/session";

export default async function MediaAdminPage() {
  const { supabase, profile } = await getSession();
  if (!profile) redirect("/ingresar?next=/admin/medios");
  const capabilities = await getCapabilities(supabase, profile.role);
  if (!isSuperadmin(profile.role) && !capabilities.manageMedia) {
    return (
      <div>
        <h1 className="display text-4xl">Medios</h1>
        <p className="mt-3 max-w-xl text-muted">El superadministrador no habilitó el cambio de fotos y videos.</p>
      </div>
    );
  }

  const [{ data }, media] = await Promise.all([
    supabase.from("ministries").select("slug, name, sort_order").order("sort_order"),
    getSiteMedia(),
  ]);
  const ministries = (data?.length ? data : defaultMinistries).map((ministry) => ({
    slug: ministry.slug,
    name: ministry.name,
  }));

  const slots: AdminMediaSlot[] = mediaCatalog(ministries).map((slot) => {
    const stored = media.overrides[slot.id];
    const followsHero = slot.id === "login" && !stored;
    const asset = followsHero ? media.hero : stored ?? fallbackForSlot(slot.id, ministries);
    return { ...slot, asset, custom: Boolean(stored), followsHero };
  });

  return (
    <div className="pb-16">
      <h1 className="display text-4xl">Medios</h1>
      <p className="mt-3 max-w-2xl leading-7 text-muted">
        Cada sección del sitio tiene su propio espacio. Elige si publicas una imagen o un video, súbelo y se actualiza en la página correspondiente.
      </p>
      <div className="mt-10">
        <MediaManager slots={slots} />
      </div>
    </div>
  );
}
