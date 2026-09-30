"use client";

import { useActionState, useEffect, useState } from "react";
import { saveMediaAsset } from "@/app/actions/media";
import { videoMime, type MediaAsset, type MediaKind } from "@/lib/media";

export type AdminMediaSlot = {
  id: string;
  group: string;
  label: string;
  hint: string;
  asset: MediaAsset;
  custom: boolean;
  followsHero?: boolean;
};

const field = "mt-1 w-full rounded-xl border border-line bg-white px-3 py-2";

export function MediaManager({ slots }: { slots: AdminMediaSlot[] }) {
  const groups = [...new Set(slots.map((slot) => slot.group))];
  return (
    <div className="space-y-12">
      {groups.map((group) => (
        <section key={group}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-orange-deep">{group}</p>
          <div className="mt-4 grid gap-5">
            {slots.filter((slot) => slot.group === group).map((slot) => (
              <MediaSlotCard key={slot.id} slot={slot} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function MediaSlotCard({ slot }: { slot: AdminMediaSlot }) {
  const [state, action, pending] = useActionState(async (_: unknown, formData: FormData) => saveMediaAsset(formData), undefined);
  const [kind, setKind] = useState<MediaKind>(slot.asset.kind);
  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");

  useEffect(() => {
    setKind(slot.asset.kind);
    setPreview(null);
    setFileName("");
  }, [slot.asset.kind, slot.asset.src, slot.asset.poster, slot.asset.alt, slot.custom]);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const shown = preview || slot.asset.src;
  const shownKind: MediaKind = preview ? kind : slot.asset.kind;

  return (
    <form action={action} className="grid gap-5 rounded-[1.6rem] border border-line bg-card p-4 md:grid-cols-[minmax(0,280px)_1fr] md:p-5">
      <input type="hidden" name="id" value={slot.id} />
      <div className="overflow-hidden rounded-2xl bg-[#f3efe8]">
        <div className="relative aspect-[16/10]">
          {shownKind === "video" ? (
            <video
              key={shown}
              className="absolute inset-0 h-full w-full object-cover"
              muted
              playsInline
              autoPlay
              loop
              poster={preview ? undefined : slot.asset.poster || undefined}
            >
              <source src={shown} type={videoMime(shown)} />
            </video>
          ) : (
            <img src={shown} alt="" className="absolute inset-0 h-full w-full object-cover" />
          )}
        </div>
        <p className="px-3 py-2 text-[11px] uppercase tracking-[0.16em] text-muted">
          {slot.followsHero ? "Usa la portada del inicio" : slot.custom ? "Archivo publicado" : "Archivo original"}
        </p>
      </div>

      <div className="min-w-0">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-medium tracking-[-0.03em]">{slot.label}</h2>
            <p className="mt-1 max-w-xl text-sm leading-6 text-muted">{slot.hint}</p>
          </div>
        </div>

        {state && "ok" in state && state.ok && (
          <p className="mt-4 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-900">Publicado en el sitio.</p>
        )}
        {state && "error" in state && state.error && (
          <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">{state.error}</p>
        )}

        <fieldset className="mt-4">
          <legend className="text-sm">Qué quieres subir</legend>
          <div className="mt-2 flex w-fit rounded-full bg-[#f3efe8] p-1">
            {(["image", "video"] as const).map((option) => (
              <label key={option} className="cursor-pointer">
                <input
                  type="radio"
                  name="kind"
                  value={option}
                  checked={kind === option}
                  onChange={() => {
                    setKind(option);
                    setPreview(null);
                    setFileName("");
                  }}
                  className="peer sr-only"
                />
                <span className="block rounded-full px-4 py-1.5 text-sm text-muted peer-checked:bg-white peer-checked:text-ink peer-checked:shadow-sm">
                  {option === "image" ? "Imagen" : "Video"}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <label className="mt-4 block text-sm">
          {kind === "video" ? "Video MP4 o WebM, hasta 60 MB" : "Imagen JPG, PNG, WebP o GIF, hasta 12 MB"}
          <input
            key={`${slot.asset.src}-${kind}`}
            name="file"
            type="file"
            accept={kind === "video" ? "video/mp4,video/webm,.mp4,.webm" : "image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif"}
            className={`${field} text-sm file:mr-3 file:rounded-full file:border-0 file:bg-ink file:px-3 file:py-1.5 file:text-xs file:text-white`}
            onChange={(event) => {
              const file = event.target.files?.[0];
              setFileName(file?.name || "");
              setPreview((current) => {
                if (current) URL.revokeObjectURL(current);
                return file ? URL.createObjectURL(file) : null;
              });
            }}
          />
        </label>
        {fileName && <p className="mt-1 truncate text-xs text-muted">{fileName}</p>}

        {kind === "video" && (
          <label className="mt-4 block text-sm">
            Imagen de portada, opcional
            <input
              name="poster"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif"
              className={`${field} text-sm file:mr-3 file:rounded-full file:border-0 file:bg-[#f3efe8] file:px-3 file:py-1.5 file:text-xs`}
            />
          </label>
        )}

        <label className="mt-4 block text-sm">
          Texto alternativo
          <input name="alt" defaultValue={slot.asset.alt} maxLength={160} className={field} />
        </label>

        <div className="mt-5 flex flex-wrap items-center gap-4">
          <button disabled={pending} name="intent" value="save" className="rounded-full bg-ink px-5 py-2.5 text-sm text-white disabled:opacity-60">
            {pending ? "Publicando…" : "Publicar"}
          </button>
          {slot.custom && (
            <button
              name="intent"
              value="restore"
              className="text-sm text-muted underline-offset-4 hover:underline"
              onClick={(event) => {
                if (!window.confirm("¿Volver al archivo original de esta sección?")) event.preventDefault();
              }}
            >
              Restaurar original
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
