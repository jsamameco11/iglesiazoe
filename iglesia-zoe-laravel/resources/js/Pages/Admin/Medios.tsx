import { MediaManager, type AdminMediaSlot } from "@/Components/admin/media-manager";
import AdminLayout from "@/Layouts/AdminLayout";
import { fallbackForSlot, mediaCatalog, type MediaAsset } from "@/lib/media";

export default function Medios({
  mediaOverrides,
  ministries,
}: {
  mediaOverrides: Record<string, MediaAsset>;
  ministries: { slug: string; name: string }[];
}) {
  const slots: AdminMediaSlot[] = mediaCatalog(ministries).map((slot) => {
    const stored = mediaOverrides[slot.id];
    return { ...slot, asset: stored ?? fallbackForSlot(slot.id, ministries), custom: Boolean(stored) };
  });

  return (
    <AdminLayout>
      <div className="pb-16">
        <h1 className="display text-4xl">Medios</h1>
        <p className="mt-3 max-w-2xl leading-7 text-muted">
          Sube o edita cada foto y video. El encuadre que ves aquí es el mismo que se publica en la web.
        </p>
        <div className="mt-10">
          <MediaManager slots={slots} />
        </div>
      </div>
    </AdminLayout>
  );
}
