import { router } from "@inertiajs/react";

export function csrf() {
  return document.querySelector('meta[name="csrf-token"]')?.getAttribute("content") || "";
}

async function postJson(url: string, formData?: FormData) {
  const res = await fetch(url, {
    method: "POST",
    body: formData,
    headers: {
      "X-CSRF-TOKEN": csrf(),
      "X-Requested-With": "XMLHttpRequest",
      Accept: "application/json",
    },
  });
  const data = await res.json().catch(() => ({}));
  if (data.redirect) {
    window.location.href = data.redirect;
    return data;
  }
  if (data.reload) {
    router.reload();
  }
  if (!res.ok && !data.error) {
    const first = data.errors ? Object.values(data.errors as Record<string, string[]>)[0]?.[0] : null;
    return { error: first || data.message || "No se pudo completar la acción." };
  }
  return data;
}

export type ActionResult = { ok?: boolean; error?: string; message?: string; [key: string]: unknown };

export async function send(url: string, payload: FormData | Record<string, string | Blob | string[] | null | undefined>): Promise<ActionResult> {
  let formData: FormData;
  if (payload instanceof FormData) {
    formData = payload;
  } else {
    formData = new FormData();
    Object.entries(payload).forEach(([key, value]) => {
      if (Array.isArray(value)) value.forEach((item) => formData.append(`${key}[]`, item));
      else if (value != null) formData.set(key, value);
    });
  }
  return postJson(url, formData);
}

export async function submitVisit(_state: { ok?: boolean; error?: string } | undefined, formData: FormData) {
  return postJson("/visita", formData);
}

export async function submitBaptism(_state: { ok?: boolean; error?: string } | undefined, formData: FormData) {
  return postJson("/bautismos", formData);
}

export async function submitPrayer(_state: { ok?: boolean; error?: string } | undefined, formData: FormData) {
  return postJson("/contacto", formData);
}

export async function saveMediaAsset(formData: FormData) {
  const data = await postJson("/admin/medios", formData);
  if (data?.ok) router.reload();
  return data;
}

export async function saveSettings(formData: FormData) {
  const data = await postJson("/admin/contenido", formData);
  if (data?.ok) router.reload();
  return data;
}

export async function saveMinistry(formData: FormData): Promise<ActionResult> {
  return postJson("/admin/ministerios", formData);
}

export async function moveMinistry(id: string, direction: "up" | "down") {
  return send("/admin/ministerios/orden", { id, direction });
}

export async function deleteMinistry(id: string) {
  return send("/admin/ministerios/eliminar", { id });
}

export async function saveTexts(formData: FormData): Promise<ActionResult> {
  return postJson("/admin/textos", formData);
}

export async function saveChurchEvent(formData: FormData): Promise<ActionResult> {
  return postJson("/admin/eventos", formData);
}

export async function deleteChurchEvent(id: string): Promise<ActionResult> {
  return send("/admin/eventos/eliminar", { id });
}

export async function submitServe(formData: FormData): Promise<ActionResult> {
  return postJson("/involucrate", formData);
}

export async function saveServeArea(formData: FormData): Promise<ActionResult> {
  return postJson("/admin/involucrate", formData);
}

export async function moveServeArea(id: string, direction: "up" | "down"): Promise<ActionResult> {
  return send("/admin/involucrate/orden", { id, direction });
}

export async function deleteServeArea(id: string): Promise<ActionResult> {
  return send("/admin/involucrate/eliminar", { id });
}

export async function saveTeaching(formData: FormData): Promise<ActionResult> {
  return postJson("/admin/recursos", formData);
}

export async function deleteTeaching(id: string): Promise<ActionResult> {
  return send("/admin/recursos/eliminar", { id });
}

export async function saveGallery(formData: FormData): Promise<ActionResult> {
  return postJson("/admin/galeria", formData);
}

export async function uploadGalleryPhoto(id: string, photo: Blob, name: string): Promise<ActionResult> {
  const formData = new FormData();
  formData.set("id", id);
  formData.set("photo", photo, name);
  return postJson("/admin/galeria/foto", formData);
}

export async function removeGalleryPhoto(id: string, path: string): Promise<ActionResult> {
  return send("/admin/galeria/foto/quitar", { id, path });
}

export async function setGalleryCover(id: string, path: string): Promise<ActionResult> {
  return send("/admin/galeria/portada", { id, path });
}

export async function deleteGallery(id: string): Promise<ActionResult> {
  return send("/admin/galeria/eliminar", { id });
}

export async function saveDevotional(formData: FormData): Promise<ActionResult> {
  return postJson("/admin/devocionales", formData);
}

export async function deleteDevotional(id: string): Promise<ActionResult> {
  return send("/admin/devocionales/eliminar", { id });
}

export async function saveSermon(formData: FormData) {
  const data = await postJson("/admin/predicas", formData);
  if (data?.error) throw new Error(data.error);
  router.reload();
}

export async function deleteSermon(id: string) {
  const formData = new FormData();
  formData.set("id", id);
  const data = await postJson("/admin/predicas/eliminar", formData);
  if (data?.error) throw new Error(data.error);
  router.reload();
}

export async function saveBaptismEvent(formData: FormData) {
  const data = await postJson("/admin/bautismos", formData);
  if (data?.error) throw new Error(data.error);
  router.reload();
}

export async function saveCell(formData: FormData) {
  const data = await postJson("/admin/celulas", formData);
  if (data?.error) throw new Error(data.error);
  router.reload();
}

export async function addMember(formData: FormData) {
  const data = await postJson("/admin/celulas/integrante", formData);
  if (data?.error) throw new Error(data.error);
  router.reload();
}

export async function removeMember(id: string) {
  const formData = new FormData();
  formData.set("id", id);
  const data = await postJson("/admin/celulas/integrante/quitar", formData);
  if (data?.error) throw new Error(data.error);
  router.reload();
}

export async function uploadTheme(formData: FormData): Promise<ActionResult> {
  return postJson("/admin/temas", formData);
}

export async function hideTheme(id: string): Promise<ActionResult> {
  return send("/admin/temas/ocultar", { id });
}

export async function loadInforme(cellId: string, year: number, week: number) {
  const res = await fetch(`/portal/informe/cargar?cell_id=${encodeURIComponent(cellId)}&year=${year}&week=${week}`, {
    headers: { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" },
  });
  return res.json();
}

export async function addParticipant(cellId: string, fullName: string) {
  const formData = new FormData();
  formData.set("cell_id", cellId);
  formData.set("full_name", fullName);
  return postJson("/portal/informe/integrante", formData);
}

export async function saveReport(formData: FormData) {
  return postJson("/portal/informe", formData);
}
