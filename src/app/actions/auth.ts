"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { leaderEmail } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export async function signIn(_state: { error?: string } | undefined, formData: FormData) {
  const username = String(formData.get("username") || "").trim();
  const password = String(formData.get("password") || "");
  const next = String(formData.get("next") || "");
  if (!username || !password) return { error: "Ingresa tu usuario y tu clave." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: leaderEmail(username),
    password,
  });
  if (error) return { error: "Usuario o clave incorrectos." };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user!.id)
    .maybeSingle();

  if (next.startsWith("/admin") && profile?.role === "admin") redirect(next);
  if (next.startsWith("/portal")) redirect(next);
  redirect(profile?.role === "admin" ? "/admin" : "/portal/informe");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/ingresar");
}

function clean(value: FormDataEntryValue | null, max = 500) {
  return String(value || "").trim().slice(0, max);
}

export async function submitVisit(_state: { ok?: boolean; error?: string } | undefined, formData: FormData) {
  const full_name = clean(formData.get("full_name"), 120);
  const phone = clean(formData.get("phone"), 30);
  if (full_name.length < 3 || phone.length < 6) {
    return { error: "Necesitamos tu nombre y un teléfono para recibirte." };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("visit_plans").insert({
    full_name,
    phone,
    email: clean(formData.get("email"), 160) || null,
    visit_date: clean(formData.get("visit_date"), 20) || null,
    service: clean(formData.get("service"), 80) || null,
    adults: Number(formData.get("adults") || 1),
    children: Number(formData.get("children") || 0),
    notes: clean(formData.get("notes"), 800) || null,
  });
  if (error) return { error: "No pudimos guardar tu visita. Inténtalo de nuevo." };
  revalidatePath("/admin/bandeja");
  return { ok: true };
}

export async function submitBaptism(_state: { ok?: boolean; error?: string } | undefined, formData: FormData) {
  const full_name = clean(formData.get("full_name"), 120);
  const phone = clean(formData.get("phone"), 30);
  if (full_name.length < 3 || phone.length < 6) {
    return { error: "Escribe tu nombre y un teléfono de contacto." };
  }
  const supabase = await createClient();
  const event = clean(formData.get("event_id"), 40);
  const { error } = await supabase.from("baptism_registrations").insert({
    full_name,
    phone,
    email: clean(formData.get("email"), 160) || null,
    event_id: event || null,
    notes: clean(formData.get("notes"), 800) || null,
  });
  if (error) return { error: "No pudimos registrar tu inscripción. Inténtalo de nuevo." };
  revalidatePath("/admin/bautismos");
  return { ok: true };
}

export async function submitPrayer(_state: { ok?: boolean; error?: string } | undefined, formData: FormData) {
  const full_name = clean(formData.get("full_name"), 120);
  const request = clean(formData.get("request"), 2000);
  if (full_name.length < 3 || request.length < 8) {
    return { error: "Cuéntanos tu nombre y cómo podemos orar por ti." };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("prayer_requests").insert({
    full_name,
    phone: clean(formData.get("phone"), 30) || null,
    email: clean(formData.get("email"), 160) || null,
    request,
  });
  if (error) return { error: "No pudimos enviar tu petición. Inténtalo de nuevo." };
  revalidatePath("/admin/bandeja");
  return { ok: true };
}
