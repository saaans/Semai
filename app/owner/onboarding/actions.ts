"use server";

import { redirect } from "next/navigation";
import { fieldErrors } from "@/lib/auth/schemas";
import { requireOwner } from "@/lib/auth/session";
import { parseProgress, type OnboardingProgress } from "@/lib/onboarding/data";
import { FIXED_SCHEDULE_NAME, type WorkMode } from "@/lib/onboarding/defaults";
import {
  jamKerjaSchema,
  lokasiSchema,
  paketSchema,
  profilUsahaSchema,
  ukuranUsahaSchema,
} from "@/lib/onboarding/schemas";
import { createClient } from "@/lib/supabase/server";

export type FormState = {
  /** Error per field, kunci = nama input. */
  errors?: Record<string, string>;
  /** Error umum di atas form. */
  message?: string;
};

const SAVE_FAILED = "Gagal menyimpan. Periksa koneksi internet, lalu coba lagi.";

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function texts(formData: FormData, key: string): string[] {
  return formData.getAll(key).filter((v): v is string => typeof v === "string");
}

/** Onboarding hanya untuk owner (admin tidak bisa mengubah profil usaha). */
async function requireOnboardingOwner() {
  const owner = await requireOwner();
  if (owner.onboardingCompleted) redirect("/owner");
  if (owner.role !== "owner") {
    return { owner, error: "Hanya owner yang bisa mengisi onboarding usaha ini." };
  }
  return { owner, error: null };
}

/** Simpan langkah yang sudah selesai. Progress tidak pernah mundur. */
async function saveProgress(companyId: string, step: number, extra: Partial<OnboardingProgress> = {}) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("companies")
    .select("onboarding")
    .eq("id", companyId)
    .single();
  if (error) return false;

  const current = parseProgress(data.onboarding);
  const { error: updateError } = await supabase
    .from("companies")
    .update({ onboarding: { ...current, ...extra, step: Math.max(current.step, step) } })
    .eq("id", companyId);
  return !updateError;
}

export async function simpanProfilUsaha(_prev: FormState, formData: FormData): Promise<FormState> {
  const { owner, error } = await requireOnboardingOwner();
  if (error) return { message: error };

  const parsed = profilUsahaSchema.safeParse({
    name: text(formData, "name"),
    businessType: text(formData, "businessType"),
    city: text(formData, "city"),
    timezone: text(formData, "timezone"),
    phone: text(formData, "phone"),
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const { name, businessType, city, timezone, phone } = parsed.data;
  const supabase = await createClient();

  const { error: companyError } = await supabase
    .from("companies")
    .update({ name, business_type: businessType, city, timezone })
    .eq("id", owner.companyId);
  if (companyError) return { message: SAVE_FAILED };

  if (phone !== owner.phone) {
    const { error: phoneError } = await supabase
      .from("profiles")
      .update({ phone })
      .eq("id", owner.userId);
    if (phoneError) return { message: SAVE_FAILED };
  }

  if (!(await saveProgress(owner.companyId, 1))) return { message: SAVE_FAILED };
  redirect("/owner/onboarding/2");
}

export async function simpanUkuranUsaha(_prev: FormState, formData: FormData): Promise<FormState> {
  const { owner, error } = await requireOnboardingOwner();
  if (error) return { message: error };

  const parsed = ukuranUsahaSchema.safeParse({
    employeeRange: text(formData, "employeeRange"),
    branchCount: text(formData, "branchCount"),
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  const { error: updateError } = await supabase
    .from("companies")
    .update({
      employee_range: parsed.data.employeeRange,
      branch_count: parsed.data.branchCount,
    })
    .eq("id", owner.companyId);
  if (updateError) return { message: SAVE_FAILED };

  if (!(await saveProgress(owner.companyId, 2))) return { message: SAVE_FAILED };
  redirect("/owner/onboarding/3");
}

export async function simpanJamKerja(_prev: FormState, formData: FormData): Promise<FormState> {
  const { owner, error } = await requireOnboardingOwner();
  if (error) return { message: error };

  const mode = text(formData, "mode") as WorkMode;
  const names = texts(formData, "scheduleName");
  const starts = texts(formData, "scheduleStart");
  const ends = texts(formData, "scheduleEnd");
  const count = mode === "tetap" ? Math.min(starts.length, 1) : starts.length;
  const schedules = Array.from({ length: count }, (_, i) => ({
    name: mode === "tetap" ? FIXED_SCHEDULE_NAME : (names[i] ?? ""),
    start: starts[i] ?? "",
    end: ends[i] ?? "",
  }));

  const parsed = jamKerjaSchema.safeParse({
    mode,
    schedules,
    workDays: texts(formData, "workDays"),
    lateToleranceMin: text(formData, "lateToleranceMin"),
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const data = parsed.data;
  const workDays = [...new Set(data.workDays)].sort((a, b) => a - b);
  const supabase = await createClient();

  // Jadwal lama: default lebih dulu, lalu urutan dibuat. Diperbarui di tempat
  // supaya id jadwal default tidak berubah kalau owner kembali ke langkah ini.
  const { data: existing, error: existingError } = await supabase
    .from("work_schedules")
    .select("id")
    .eq("company_id", owner.companyId)
    .order("is_default", { ascending: false })
    .order("created_at");
  if (existingError) return { message: SAVE_FAILED };

  for (const [i, schedule] of data.schedules.entries()) {
    const row = {
      name: schedule.name,
      start_time: schedule.start,
      end_time: schedule.end,
      work_days: workDays,
      late_tolerance_min: data.lateToleranceMin,
      is_default: i === 0,
    };
    const target = existing[i];
    const { error: writeError } = target
      ? await supabase.from("work_schedules").update(row).eq("id", target.id)
      : await supabase.from("work_schedules").insert({ ...row, company_id: owner.companyId });
    if (writeError) return { message: SAVE_FAILED };
  }

  const extras = existing.slice(data.schedules.length).map((row) => row.id);
  if (extras.length > 0) {
    const { error: deleteError } = await supabase.from("work_schedules").delete().in("id", extras);
    if (deleteError) return { message: SAVE_FAILED };
  }

  if (!(await saveProgress(owner.companyId, 3, { mode: data.mode }))) {
    return { message: SAVE_FAILED };
  }
  redirect("/owner/onboarding/4");
}

export async function simpanLokasi(_prev: FormState, formData: FormData): Promise<FormState> {
  const { owner, error } = await requireOnboardingOwner();
  if (error) return { message: error };

  const parsed = lokasiSchema.safeParse({
    name: text(formData, "name"),
    latitude: text(formData, "latitude"),
    longitude: text(formData, "longitude"),
    radiusM: text(formData, "radiusM"),
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const row = {
    name: parsed.data.name,
    latitude: parsed.data.latitude,
    longitude: parsed.data.longitude,
    radius_m: parsed.data.radiusM,
    is_active: true,
  };
  const supabase = await createClient();

  const { data: existing, error: existingError } = await supabase
    .from("locations")
    .select("id")
    .eq("company_id", owner.companyId)
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (existingError) return { message: SAVE_FAILED };

  const { error: writeError } = existing
    ? await supabase.from("locations").update(row).eq("id", existing.id)
    : await supabase.from("locations").insert({ ...row, company_id: owner.companyId });
  if (writeError) {
    // Pesan dari trigger batas lokasi sudah ramah untuk owner.
    return { message: writeError.code === "P0001" ? writeError.message : SAVE_FAILED };
  }

  if (!(await saveProgress(owner.companyId, 4))) return { message: SAVE_FAILED };
  redirect("/owner/onboarding/5");
}

export async function lewatiUndangan(): Promise<FormState> {
  const { owner, error } = await requireOnboardingOwner();
  if (error) return { message: error };

  if (!(await saveProgress(owner.companyId, 5))) return { message: SAVE_FAILED };
  redirect("/owner/onboarding/6");
}

export async function pilihPaket(_prev: FormState, formData: FormData): Promise<FormState> {
  const { owner, error } = await requireOnboardingOwner();
  if (error) return { message: error };

  const parsed = paketSchema.safeParse({
    choice: text(formData, "choice"),
    planCode: text(formData, "planCode") || undefined,
  });
  if (!parsed.success) return { message: fieldErrors(parsed.error).choice ?? SAVE_FAILED };

  const supabase = await createClient();
  const { error: rpcError } = await supabase.rpc("complete_onboarding", {
    p_company_id: owner.companyId,
    p_choice: parsed.data.choice,
    p_plan_code: parsed.data.choice === "berbayar" ? parsed.data.planCode : undefined,
  });
  if (rpcError) {
    // Pesan dari RPC (data belum lengkap, paket tidak tersedia) sudah ramah.
    const friendly = rpcError.code === "P0001" || rpcError.code === "22023";
    return { message: friendly ? rpcError.message : SAVE_FAILED };
  }

  redirect("/owner");
}
