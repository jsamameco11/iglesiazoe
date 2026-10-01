"use server";

import { revalidatePath } from "next/cache";
import { getCapabilities, isStaff, isSuperadmin } from "@/lib/access";
import {
  classifyUpload,
  clampFocus,
  compactGalleryOverrides,
  fallbackForSlot,
  galleryFallback,
  galleryIndex,
  gallerySlotId,
  GALLERY_MAX,
  GALLERY_MIN,
  isAllowedSlot,
  isGallerySlot,
  listGalleryIndexes,
  normalizeFeather,
  normalizeFit,
  normalizeRadius,
  normalizeRatio,
  normalizeZoom,
  readOverrides,
  storagePathFromPublicUrl,
  uploadTooLarge,
  type MediaAsset,
  type MediaKind,
} from "@/lib/media";
import { getSession } from "@/lib/session";

async function requireMediaAdmin() {
  const session = await getSession();
  if (!isStaff(session.profile?.role)) return { error: "No autorizado." as const, session: null };
  const caps = await getCapabilities(session.supabase, session.profile?.role);
  if (!isSuperadmin(session.profile?.role) && !caps.manageMedia) {
    return { error: "No tienes permiso para cambiar fotos y videos." as const, session: null };
  }
  return { error: null, session };
}

function extension(file: File, kind: MediaKind) {
  const fromName = file.name.split(".").pop()?.toLowerCase() || "";
  if (/^(jpe?g|png|webp|gif|mp4|webm)$/.test(fromName)) return fromName === "jpeg" ? "jpg" : fromName;
  return kind === "video" ? "mp4" : "jpg";
}

export async function saveMediaAsset(formData: FormData) {
  const gate = await requireMediaAdmin();
  if (gate.error || !gate.session) return { error: gate.error || "No autorizado." };
  const { supabase } = gate.session;

  const id = String(formData.get("id") || "");
  if (!isAllowedSlot(id)) return { error: "Esa sección no existe." };

  const { data: currentRow } = await supabase.from("site_settings").select("value").eq("key", "media").maybeSingle();
  const overrides = readOverrides(currentRow?.value);
  const intent = String(formData.get("intent") || "save");

  if (intent === "restore") {
    delete overrides[id];
    const { error } = await supabase.from("site_settings").upsert({
      key: "media",
      value: { assets: overrides },
      updated_at: new Date().toISOString(),
    });
    if (error) return { error: "No se pudo restaurar el archivo original." };
    revalidatePath("/", "layout");
    revalidatePath("/admin/medios");
    revalidatePath("/ingresar");
    return { ok: true };
  }

  if (intent === "remove-gallery") {
    if (!isGallerySlot(id) || galleryIndex(id) <= GALLERY_MIN) {
      return { error: "Las primeras 6 fotos del carrusel no se pueden quitar." };
    }
    const previous = overrides[id];
    delete overrides[id];
    compactGalleryOverrides(overrides);
    const { error } = await supabase.from("site_settings").upsert({
      key: "media",
      value: { assets: overrides },
      updated_at: new Date().toISOString(),
    });
    if (error) return { error: "No se pudo quitar la foto del carrusel." };
    const retired = previous ? [storagePathFromPublicUrl(previous.src), storagePathFromPublicUrl(previous.poster)].filter((path): path is string => Boolean(path)) : [];
    if (retired.length) await supabase.storage.from("medios").remove(retired);
    revalidatePath("/", "layout");
    revalidatePath("/admin/medios");
    revalidatePath("/marea");
    return { ok: true };
  }

  const kind = String(formData.get("kind") || "") as MediaKind;
  if (kind !== "image" && kind !== "video") return { error: "Elige imagen o video." };
  const alt = String(formData.get("alt") || "").trim().slice(0, 160);
  const ratio = normalizeRatio(
    String(formData.get("ratio") || "natural"),
    String(formData.get("ratioWidth") || ""),
    String(formData.get("ratioHeight") || ""),
  );
  const fit = normalizeFit(String(formData.get("fit") || "fill"));
  const posX = clampFocus(formData.get("posX"));
  const posY = clampFocus(formData.get("posY"));
  const zoom = normalizeZoom(formData.get("zoom"));
  const radius = normalizeRadius(formData.get("radius"));
  const feather = formData.get("featherOn") === "on" ? normalizeFeather(formData.get("feather") || 16) : 0;
  const previous = overrides[id];
  const fallback = fallbackForSlot(id);
  const selected = formData.get("file");
  const selectedPoster = formData.get("poster");
  const file = selected instanceof File && selected.size > 0 ? selected : null;
  const posterFile = selectedPoster instanceof File && selectedPoster.size > 0 ? selectedPoster : null;

  if (file) {
    const uploadedKind = classifyUpload(file);
    if (uploadedKind !== kind) {
      return { error: kind === "video" ? "Sube un video MP4 o WebM." : "Sube una imagen JPG, PNG, WebP o GIF." };
    }
    if (uploadTooLarge(kind, file.size)) {
      return { error: kind === "video" ? "El video supera los 60 MB." : "La imagen supera los 12 MB." };
    }
  } else if ((!previous || previous.kind !== kind) && (!fallback.src || fallback.kind !== kind)) {
    return { error: kind === "video" ? "Sube el video que quieres publicar." : "Sube la imagen que quieres publicar." };
  }

  if (kind === "video" && posterFile) {
    if (classifyUpload(posterFile) !== "image") return { error: "La portada del video tiene que ser una imagen." };
    if (uploadTooLarge("image", posterFile.size)) return { error: "La portada supera los 12 MB." };
  }

  let src = previous?.src || fallback.src || "";
  let posterSrc = previous?.kind === kind ? previous.poster : fallback.kind === kind ? fallback.poster : "";
  const uploadedPaths: string[] = [];

  if (file) {
    const path = `site/${id.replace(":", "/")}/${Date.now()}.${extension(file, kind)}`;
    const { error: uploadError } = await supabase.storage.from("medios").upload(path, file, {
      contentType: file.type || (kind === "video" ? "video/mp4" : "image/jpeg"),
      upsert: false,
    });
    if (uploadError) return { error: "No se pudo subir el archivo. Inténtalo otra vez." };
    uploadedPaths.push(path);
    src = supabase.storage.from("medios").getPublicUrl(path).data.publicUrl;
  }

  if (kind === "video" && posterFile) {
    const path = `site/${id.replace(":", "/")}/poster-${Date.now()}.${extension(posterFile, "image")}`;
    const { error: uploadError } = await supabase.storage.from("medios").upload(path, posterFile, {
      contentType: posterFile.type || "image/jpeg",
      upsert: false,
    });
    if (uploadError) {
      if (uploadedPaths.length) await supabase.storage.from("medios").remove(uploadedPaths);
      return { error: "No se pudo subir la portada del video." };
    }
    uploadedPaths.push(path);
    posterSrc = supabase.storage.from("medios").getPublicUrl(path).data.publicUrl;
  }

  if (kind === "image") posterSrc = "";

  const next: MediaAsset = { kind, src, poster: posterSrc, alt, ratio, fit, posX, posY, zoom, radius, feather };
  overrides[id] = next;
  const { error } = await supabase.from("site_settings").upsert({
    key: "media",
    value: { assets: overrides },
    updated_at: new Date().toISOString(),
  });
  if (error) {
    if (uploadedPaths.length) await supabase.storage.from("medios").remove(uploadedPaths);
    return { error: "No se pudo publicar el archivo." };
  }

  const retired = [
    file && previous ? storagePathFromPublicUrl(previous.src) : null,
    (kind === "image" || posterFile) && previous ? storagePathFromPublicUrl(previous.poster) : null,
  ].filter((path): path is string => Boolean(path));
  if (retired.length) await supabase.storage.from("medios").remove(retired);

  revalidatePath("/", "layout");
  revalidatePath("/admin/medios");
  revalidatePath("/ingresar");
  revalidatePath("/marea");
  return { ok: true };
}

export async function addGallerySlot() {
  const gate = await requireMediaAdmin();
  if (gate.error || !gate.session) return { error: gate.error || "No autorizado." };
  const { supabase } = gate.session;

  const { data: currentRow } = await supabase.from("site_settings").select("value").eq("key", "media").maybeSingle();
  const overrides = readOverrides(currentRow?.value);
  const next = listGalleryIndexes(overrides).length + 1;
  if (next > GALLERY_MAX) return { error: `Puedes tener hasta ${GALLERY_MAX} fotos en el carrusel.` };

  overrides[gallerySlotId(next)] = galleryFallback(next);
  const { error } = await supabase.from("site_settings").upsert({
    key: "media",
    value: { assets: overrides },
    updated_at: new Date().toISOString(),
  });
  if (error) return { error: "No se pudo añadir la foto al carrusel." };

  revalidatePath("/", "layout");
  revalidatePath("/admin/medios");
  revalidatePath("/marea");
  return { ok: true };
}
