"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";

async function requireUser() {
  const session = await getSession();
  if (!session.profile) throw new Error("Sesión expirada");
  return session;
}

export async function loadInforme(cellId: string, year: number, week: number) {
  const { supabase } = await requireUser();
  const [{ data: cell }, { data: members }, { data: report }, { data: themes }] = await Promise.all([
    supabase.from("cells").select("*").eq("id", cellId).maybeSingle(),
    supabase.from("cell_members").select("*").eq("cell_id", cellId).eq("active", true).order("full_name"),
    supabase
      .from("reports")
      .select("*, report_attendance(*), report_photos(*)")
      .eq("cell_id", cellId)
      .eq("year", year)
      .eq("week", week)
      .maybeSingle(),
    supabase.from("themes").select("*").eq("active", true).order("theme_date", { ascending: false }).limit(120),
  ]);

  const photos = await Promise.all(
    ((report?.report_photos as { id: string; file_path: string }[]) || []).map(async (photo) => {
      const { data } = await supabase.storage.from("informes").createSignedUrl(photo.file_path, 60 * 60);
      return { id: photo.id, url: data?.signedUrl || "" };
    }),
  );

  return { cell, members: members ?? [], report, themes: themes ?? [], photos };
}

export async function addParticipant(cellId: string, fullName: string) {
  const { supabase } = await requireUser();
  const name = fullName.trim();
  if (name.length < 3) return { error: "Escribe el nombre del integrante." };
  const { error } = await supabase.from("cell_members").insert({ cell_id: cellId, full_name: name });
  if (error) return { error: "No se pudo agregar al integrante." };
  revalidatePath("/portal/informe");
  return { ok: true };
}

export async function saveReport(formData: FormData) {
  const { supabase, user } = await requireUser();
  const cellId = String(formData.get("cell_id") || "");
  const year = Number(formData.get("year"));
  const week = Number(formData.get("week"));
  const met = String(formData.get("met")) === "si";
  if (!cellId || !year || !week) return { error: "Selecciona año, semana y célula." };

  const payload = {
    cell_id: cellId,
    user_id: user!.id,
    year,
    week,
    met,
    reason: met ? null : String(formData.get("reason") || "").trim(),
    meeting_date: met ? String(formData.get("meeting_date") || "") || null : null,
    start_time: met ? String(formData.get("start_time") || "") || null : null,
    end_time: met ? String(formData.get("end_time") || "") || null : null,
    modality: met ? String(formData.get("modality") || "presencial") : null,
    theme_id: met ? String(formData.get("theme_id") || "") || null : null,
    theme_title: met ? String(formData.get("theme_title") || "").trim() : null,
    praise_minutes: met ? Number(formData.get("praise_minutes") || 0) : 0,
    had_prayer: met ? String(formData.get("had_prayer")) === "si" : null,
    prayer_notes: met ? String(formData.get("prayer_notes") || "").trim() : null,
    teaching_minutes: met ? Number(formData.get("teaching_minutes") || 0) : 0,
    salvations: met ? Number(formData.get("salvations") || 0) : 0,
    spirit_baptisms: met ? Number(formData.get("spirit_baptisms") || 0) : 0,
    reconciled: met ? Number(formData.get("reconciled") || 0) : 0,
    offering: met ? Number(formData.get("offering") || 0) : 0,
    offering_minutes: met ? Number(formData.get("offering_minutes") || 0) : 0,
    families: met ? Number(formData.get("families") || 0) : 0,
    guests: met ? Number(formData.get("guests") || 0) : 0,
    testimonies: met ? String(formData.get("testimonies") || "").trim() : null,
    updated_at: new Date().toISOString(),
  };

  if (!met && !payload.reason) return { error: "Indica el motivo por el que no se reunieron." };

  const { data: report, error } = await supabase
    .from("reports")
    .upsert(payload, { onConflict: "cell_id,year,week" })
    .select("id")
    .single();
  if (error || !report) return { error: "No se pudo guardar el informe." };

  if (met) {
    const attendance = JSON.parse(String(formData.get("attendance") || "[]")) as {
      member_id: string;
      member_name: string;
      attended: boolean;
      tithe: number;
    }[];
    await supabase.from("report_attendance").delete().eq("report_id", report.id);
    if (attendance.length) {
      const { error: attendanceError } = await supabase.from("report_attendance").insert(
        attendance.map((row) => ({
          report_id: report.id,
          member_id: row.member_id || null,
          member_name: row.member_name,
          attended: !!row.attended,
          tithe: Number(row.tithe || 0),
        })),
      );
      if (attendanceError) return { error: "El informe se guardó, pero falló la asistencia." };
    }

    const files = formData.getAll("photos").filter((file): file is File => file instanceof File && file.size > 0);
    for (const file of files) {
      const safe = file.name.replace(/[^\w.\-]+/g, "_");
      const path = `${user!.id}/${report.id}/${Date.now()}-${safe}`;
      const { error: uploadError } = await supabase.storage
        .from("informes")
        .upload(path, file, { contentType: file.type || "image/jpeg" });
      if (!uploadError) {
        await supabase.from("report_photos").insert({ report_id: report.id, file_path: path });
      }
    }
  }

  revalidatePath("/portal/informe");
  revalidatePath("/portal/historial");
  revalidatePath("/portal/seguimiento");
  revalidatePath("/admin/informes");
  return { ok: true };
}

export async function themeDownloadUrl(filePath: string) {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.storage.from("temas").createSignedUrl(filePath, 60 * 10);
  if (error || !data) return { error: "No se pudo preparar la descarga." };
  return { url: data.signedUrl };
}
