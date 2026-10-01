import { MediaManager, type AdminMediaSlot } from "@/Components/admin/media-manager";
import AdminLayout from "@/Layouts/AdminLayout";
import { fallbackForSlot, mediaCatalog, resolveMedia, type MediaAsset } from "@/lib/media";

export default function Medios({
  mediaOverrides,
  ministries,
  allowed,
}: {
  mediaOverrides: Record<string, MediaAsset>;
  ministries: { slug: string; name: string }[];
  allowed: boolean;
}) {
  const media = resolveMedia(mediaOverrides);
  const slots: AdminMediaSlot[] = mediaCatalog(ministries, media.overrides).map((slot) => {
    const stored = media.overrides[slot.id];
    const followsHero = slot.id === "login" && !stored;
    const asset = followsHero ? media.hero : stored ?? fallbackForSlot(slot.id, ministries);
    return { ...slot, asset, custom: Boolean(stored), followsHero };
  });

  return (
    <AdminLayout>
      <div className="pb-16">
        <h1 className="display text-4xl">Medios</h1>
        {allowed ? (
          <>
            <p className="mt-3 max-w-2xl leading-7 text-muted">
              Sube, añade o edita cada foto. El encuadre que ves aquí es el mismo que se publica en la web. El carrusel del inicio necesita al menos 6 fotos para que la del centro cambie.
            </p>
            <div className="mt-10">
              <MediaManager slots={slots} />
            </div>
          </>
        ) : (
          <p className="mt-3 max-w-xl text-muted">El superadministrador no habilitó el cambio de fotos y videos.</p>
        )}
      </div>
    </AdminLayout>
  );
}
