import { router } from "@inertiajs/react";

function csrf() {
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

export async function signIn(_state: { error?: string } | undefined, formData: FormData) {
  const username = String(formData.get("username") || "").trim();
  const password = String(formData.get("password") || "");
  if (!username || !password) return { error: "Ingresa tu usuario y tu clave." };
  const data = await postJson("/acceso", formData);
  if (data?.error) return { error: data.error };
  return data;
}

export async function signOut() {
  router.post("/salir");
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

export async function addGallerySlot() {
  const data = await postJson("/admin/medios/galeria", new FormData());
  if (data?.ok) router.reload();
  return data;
}

export async function saveSettings(formData: FormData) {
  const data = await postJson("/admin/contenido", formData);
  if (data?.ok) router.reload();
  return data;
}

export async function saveMinistry(formData: FormData) {
  const data = await postJson("/admin/ministerios", formData);
  if (data?.error) throw new Error(data.error);
  router.reload();
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

export async function createRootCell(networkId: string, networkCode: string) {
  const formData = new FormData();
  formData.set("network_id", networkId);
  formData.set("network_code", networkCode);
  const data = await postJson("/admin/celulas/raiz", formData);
  if (data?.ok) router.reload();
  return data;
}

export async function ensureSixCells(networkId: string, networkCode: string) {
  const formData = new FormData();
  formData.set("network_id", networkId);
  formData.set("network_code", networkCode);
  const data = await postJson("/admin/celulas/completar", formData);
  if (data?.ok) router.reload();
  return data;
}

export async function createDaughter(parentId: string, parentCode: string, networkId: string) {
  const formData = new FormData();
  formData.set("parent_id", parentId);
  formData.set("parent_code", parentCode);
  formData.set("network_id", networkId);
  const data = await postJson("/admin/celulas/hija", formData);
  if (data?.ok) router.reload();
  return data;
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

export async function uploadTheme(formData: FormData) {
  const data = await postJson("/admin/temas", formData);
  if (data?.error) throw new Error(data.error);
  router.reload();
}

export async function deleteTheme(id: string) {
  const formData = new FormData();
  formData.set("id", id);
  const data = await postJson("/admin/temas/ocultar", formData);
  if (data?.error) throw new Error(data.error);
  router.reload();
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

export async function themeDownloadUrl(filePath: string) {
  const res = await fetch(`/portal/temas/archivo?path=${encodeURIComponent(filePath)}`, {
    headers: { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" },
  });
  return res.json();
}
