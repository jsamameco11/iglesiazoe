"use server";

import { revalidatePath } from "next/cache";
import { daughterCellCode, rootCellCode } from "@/lib/cells";
import { getSession } from "@/lib/session";
import { isStaff, isSuperadmin, type AdminCapabilities } from "@/lib/access";
import type { SiteSettings } from "@/lib/types";

async function requireAdmin() {
  const session = await getSession();
  if (!isStaff(session.profile?.role)) throw new Error("No autorizado");
  return session;
}

function text(formData: FormData, key: string, max = 500) {
  return String(formData.get(key) || "").trim().slice(0, max);
}

export async function saveSettings(formData: FormData) {
  const { supabase } = await requireAdmin();
  const current = JSON.parse(text(formData, "current", 20000) || "{}") as SiteSettings;
  const values = [1, 2, 3, 4].map((index) => ({
    title: text(formData, `value_title_${index}`, 80),
    text: text(formData, `value_text_${index}`, 400),
  })).filter((value) => value.title);
  const next: SiteSettings = {
    ...current,
    heroTitle: text(formData, "heroTitle", 240),
    heroSubtitle: text(formData, "heroSubtitle", 400),
    city: text(formData, "city", 120),
    address: text(formData, "address", 180),
    sunday: text(formData, "sunday", 80),
    wednesday: text(formData, "wednesday", 80),
    pastor: text(formData, "pastor", 120),
    pastorsLabel: text(formData, "pastorsLabel", 160),
    aboutQuote: text(formData, "aboutQuote", 400),
    aboutText: text(formData, "aboutText", 1200),
    vision: text(formData, "vision", 800),
    history: text(formData, "history", 1600),
    values,
    facebook: text(formData, "facebook", 240),
    youtube: text(formData, "youtube", 240),
    mapUrl: text(formData, "mapUrl", 400),
    liveYoutubeId: text(formData, "liveYoutubeId", 40),
    phone: text(formData, "phone", 40),
    email: text(formData, "email", 160),
    bankSoles: text(formData, "bankSoles", 40),
    bankSolesCci: text(formData, "bankSolesCci", 40),
    bankDollars: text(formData, "bankDollars", 40),
    bankDollarsCci: text(formData, "bankDollarsCci", 40),
    yape: text(formData, "yape", 20),
    cardUrl: text(formData, "cardUrl", 400),
    headingColor: text(formData, "headingColor", 20) || "#1c1b19",
    bodyColor: text(formData, "bodyColor", 20) || "#5e5a54",
    fontPair: (["mixed", "grotesque", "editorial"].includes(text(formData, "fontPair", 20))
      ? text(formData, "fontPair", 20)
      : "mixed") as SiteSettings["fontPair"],
    visitCta: text(formData, "visitCta", 80),
    sermonsCta: text(formData, "sermonsCta", 80),
    baptismCta: text(formData, "baptismCta", 80),
    railTitle: text(formData, "railTitle", 160),
    railText: text(formData, "railText", 400),
    ctaVisitTitle: text(formData, "ctaVisitTitle", 80),
    ctaVisitText: text(formData, "ctaVisitText", 240),
    ctaBaptismTitle: text(formData, "ctaBaptismTitle", 80),
    ctaBaptismText: text(formData, "ctaBaptismText", 240),
    ctaPrayerTitle: text(formData, "ctaPrayerTitle", 80),
    ctaPrayerText: text(formData, "ctaPrayerText", 240),
    homeFamilyKicker: text(formData, "homeFamilyKicker", 80),
    homeFamilyTitle: text(formData, "homeFamilyTitle", 160),
    homeMinistriesTitle: text(formData, "homeMinistriesTitle", 160),
    footerTagline: text(formData, "footerTagline", 240),
    aboutKicker: text(formData, "aboutKicker", 80),
    aboutTitle: text(formData, "aboutTitle", 160),
    aboutValuesTitle: text(formData, "aboutValuesTitle", 160),
    aboutValuesText: text(formData, "aboutValuesText", 400),
    ministriesTitle: text(formData, "ministriesTitle", 160),
    ministriesText: text(formData, "ministriesText", 400),
    baptismTitle: text(formData, "baptismTitle", 160),
    baptismLead: text(formData, "baptismLead", 160),
    baptismBody: text(formData, "baptismBody", 1200),
    baptismDateLabel: text(formData, "baptismDateLabel", 80),
    baptismRequirementLabel: text(formData, "baptismRequirementLabel", 80),
    baptismRequirement: text(formData, "baptismRequirement", 240),
    baptismDateFallback: text(formData, "baptismDateFallback", 80),
    visitTitle: text(formData, "visitTitle", 160),
    visitText: text(formData, "visitText", 400),
    contactTitle: text(formData, "contactTitle", 160),
    prayerTitle: text(formData, "prayerTitle", 160),
    giveTitle: text(formData, "giveTitle", 160),
    giveLead: text(formData, "giveLead", 240),
    giveBody: text(formData, "giveBody", 1200),
    giveYapeText: text(formData, "giveYapeText", 240),
    giveCardText: text(formData, "giveCardText", 240),
    sermonsTitle: text(formData, "sermonsTitle", 160),
    sermonsEmpty: text(formData, "sermonsEmpty", 240),
  };
  const { error } = await supabase.from("site_settings").upsert({
    key: "site",
    value: next,
    updated_at: new Date().toISOString(),
  });
  if (error) return { error: "No se pudo guardar el contenido." };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function saveMinistry(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = text(formData, "id", 40);
  const payload = {
    slug: text(formData, "slug", 80),
    name: text(formData, "name", 80),
    age_range: text(formData, "age_range", 80),
    summary: text(formData, "summary", 180),
    body: text(formData, "body", 1200),
    sort_order: Number(formData.get("sort_order") || 0),
    accent: text(formData, "accent", 20) || "#f3d7b0",
    active: formData.get("active") === "on",
  };
  const query = id
    ? supabase.from("ministries").update(payload).eq("id", id)
    : supabase.from("ministries").insert(payload);
  const { error } = await query;
  if (error) throw new Error("No se pudo guardar el ministerio.");
  revalidatePath("/ministerios");
  revalidatePath("/admin/ministerios");
}

export async function saveSermon(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = text(formData, "id", 40);
  const payload = {
    title: text(formData, "title", 180),
    preacher: text(formData, "preacher", 120) || null,
    series: text(formData, "series", 120) || null,
    sermon_date: text(formData, "sermon_date", 20) || null,
    youtube_id: text(formData, "youtube_id", 40) || null,
    is_live: formData.get("is_live") === "on",
    published: formData.get("published") === "on",
  };
  if (!payload.title) throw new Error("El título es obligatorio.");
  const query = id
    ? supabase.from("sermons").update(payload).eq("id", id)
    : supabase.from("sermons").insert(payload);
  const { error } = await query;
  if (error) throw new Error("No se pudo guardar la prédica.");
  revalidatePath("/predicas");
  revalidatePath("/admin/predicas");
}

export async function deleteSermon(id: string) {
  const { supabase } = await requireAdmin();
  await supabase.from("sermons").delete().eq("id", id);
  revalidatePath("/predicas");
  revalidatePath("/admin/predicas");
}

export async function saveBaptismEvent(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = text(formData, "id", 40);
  const payload = {
    event_date: text(formData, "event_date", 20) || null,
    location: text(formData, "location", 180) || null,
    notes: text(formData, "notes", 400) || null,
    active: formData.get("active") === "on",
  };
  const query = id
    ? supabase.from("baptism_events").update(payload).eq("id", id)
    : supabase.from("baptism_events").insert(payload);
  const { error } = await query;
  if (error) throw new Error("No se pudo guardar la fecha.");
  revalidatePath("/bautismos");
  revalidatePath("/admin/bautismos");
}

export async function saveCell(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = text(formData, "id", 40);
  const payload = {
    leader_name: text(formData, "leader_name", 160) || null,
    assistant_name: text(formData, "assistant_name", 160) || null,
    host_name: text(formData, "host_name", 160) || null,
    address: text(formData, "address", 240) || null,
    meeting_day: text(formData, "meeting_day", 20) || null,
    meeting_time: text(formData, "meeting_time", 10) || null,
    active: formData.get("active") === "on",
  };
  const { error } = await supabase.from("cells").update(payload).eq("id", id);
  if (error) throw new Error("No se pudo actualizar la célula.");
  revalidatePath("/admin/celulas");
}

export async function createRootCell(networkId: string, networkCode: string) {
  const { supabase } = await requireAdmin();
  const { data: existing } = await supabase
    .from("cells")
    .select("number")
    .eq("network_id", networkId)
    .is("parent_id", null);
  const next = Math.max(0, ...(existing || []).map((row) => row.number)) + 1;
  const code = rootCellCode(networkCode, next);
  const { error } = await supabase.from("cells").insert({
    network_id: networkId,
    number: next,
    code,
    active: true,
  });
  if (error) return { error: "No se pudo crear la célula." };
  revalidatePath("/admin/celulas");
  return { ok: true, code };
}

export async function ensureSixCells(networkId: string, networkCode: string) {
  const { supabase } = await requireAdmin();
  const { data: existing } = await supabase
    .from("cells")
    .select("code")
    .eq("network_id", networkId)
    .is("parent_id", null);
  const codes = new Set((existing || []).map((row) => row.code));
  const rows = [];
  for (let number = 1; number <= 6; number++) {
    const code = rootCellCode(networkCode, number);
    if (!codes.has(code)) rows.push({ network_id: networkId, number, code, active: true });
  }
  if (rows.length) {
    const { error } = await supabase.from("cells").insert(rows);
    if (error) return { error: "No se pudieron crear las células." };
  }
  revalidatePath("/admin/celulas");
  return { ok: true, created: rows.length };
}

export async function createDaughter(parentId: string, parentCode: string, networkId: string) {
  const { supabase } = await requireAdmin();
  const { data: sisters } = await supabase.from("cells").select("number").eq("parent_id", parentId);
  const next = Math.max(0, ...(sisters || []).map((row) => row.number)) + 1;
  const code = daughterCellCode(parentCode, next);
  const { error } = await supabase.from("cells").insert({
    network_id: networkId,
    parent_id: parentId,
    number: next,
    code,
    active: true,
  });
  if (error) return { error: "No se pudo crear la célula hija." };
  revalidatePath("/admin/celulas");
  return { ok: true, code };
}

export async function addMember(formData: FormData) {
  const { supabase, profile } = await requireAdmin();
  const { getCapabilities, isSuperadmin } = await import("@/lib/access");
  const caps = await getCapabilities(supabase, profile?.role);
  if (!isSuperadmin(profile?.role) && !caps.manageMembers) {
    throw new Error("El superadministrador no habilitó la gestión de integrantes.");
  }
  const full_name = text(formData, "full_name", 160);
  const cell_id = text(formData, "cell_id", 40);
  if (!full_name || !cell_id) throw new Error("Falta el nombre o la célula.");
  const { error } = await supabase.from("cell_members").insert({
    cell_id,
    full_name,
    phone: text(formData, "phone", 30) || null,
  });
  if (error) throw new Error("No se pudo agregar al integrante.");
  revalidatePath("/admin/celulas");
}

export async function removeMember(id: string) {
  const { supabase, profile } = await requireAdmin();
  const { getCapabilities, isSuperadmin } = await import("@/lib/access");
  const caps = await getCapabilities(supabase, profile?.role);
  if (!isSuperadmin(profile?.role) && !caps.manageMembers) {
    throw new Error("El superadministrador no habilitó la gestión de integrantes.");
  }
  await supabase.from("cell_members").update({ active: false }).eq("id", id);
  revalidatePath("/admin/celulas");
}

export async function createLeader(formData: FormData) {
  const { supabase, profile } = await requireAdmin();
  const { getCapabilities, isSuperadmin } = await import("@/lib/access");
  const caps = await getCapabilities(supabase, profile?.role);
  if (!isSuperadmin(profile?.role) && !caps.manageUsers) {
    throw new Error("El superadministrador no habilitó la gestión de usuarios.");
  }
  const role = text(formData, "role", 20);
  if (role === "admin" && !isSuperadmin(profile?.role)) {
    throw new Error("Solo el superadministrador puede crear administradores.");
  }
  const cellCodes = text(formData, "cell_codes", 200)
    .split(",")
    .map((code) => code.trim())
    .filter(Boolean);
  const { error } = await supabase.rpc("admin_create_user", {
    p_username: text(formData, "username", 40),
    p_password: String(formData.get("password") || ""),
    p_full_name: text(formData, "full_name", 160),
    p_role: role,
    p_network_code: text(formData, "network_code", 2),
    p_cell_codes: cellCodes,
  });
  if (error) throw new Error(error.message || "No se pudo crear el usuario.");
  revalidatePath("/admin/usuarios");
}

export async function resetPassword(formData: FormData) {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.rpc("admin_set_password", {
    p_user_id: text(formData, "user_id", 40),
    p_password: String(formData.get("password") || ""),
  });
  if (error) throw new Error(error.message || "No se pudo cambiar la clave.");
}

export async function uploadTheme(formData: FormData) {
  const { supabase } = await requireAdmin();
  const title = text(formData, "title", 200);
  const theme_date = text(formData, "theme_date", 20);
  if (!title || !theme_date) throw new Error("Título y fecha son obligatorios.");
  const file = formData.get("file");
  let file_path: string | null = null;
  if (file instanceof File && file.size > 0) {
    const safe = file.name.replace(/[^\w.\-]+/g, "_");
    file_path = `${theme_date}-${Date.now()}-${safe}`;
    const { error: uploadError } = await supabase.storage
      .from("temas")
      .upload(file_path, file, { contentType: file.type || "application/pdf" });
    if (uploadError) throw new Error("No se pudo subir el archivo.");
  }
  const { error } = await supabase.from("themes").insert({
    title,
    audience: text(formData, "audience", 80) || "Iglesia",
    theme_date,
    file_path,
    active: true,
  });
  if (error) throw new Error("No se pudo registrar el tema.");
  revalidatePath("/portal/temas");
  revalidatePath("/admin/temas");
}

export async function deleteTheme(id: string) {
  const { supabase } = await requireAdmin();
  await supabase.from("themes").update({ active: false }).eq("id", id);
  revalidatePath("/portal/temas");
  revalidatePath("/admin/temas");
}

export async function saveCapabilities(formData: FormData) {
  const { supabase, profile } = await requireAdmin();
  if (!isSuperadmin(profile?.role)) throw new Error("Solo el superadministrador puede definir estos accesos.");
  const keys: (keyof AdminCapabilities)[] = [
    "manageMembers",
    "viewOfferings",
    "viewCellActivity",
    "manageMedia",
    "manageContent",
    "manageCells",
    "manageUsers",
    "manageGenerosity",
  ];
  const value = Object.fromEntries(keys.map((key) => [key, formData.get(key) === "on"])) as AdminCapabilities;
  const { error } = await supabase.from("site_settings").upsert({
    key: "admin_capabilities",
    value,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error("No se pudieron guardar los accesos del administrador.");
  revalidatePath("/admin");
  revalidatePath("/admin/accesos");
}
