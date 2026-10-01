"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fieldErrors } from "@/lib/auth/schemas";
import { requireOwner } from "@/lib/auth/session";
import { LOGO_BUCKET, LOGO_TYPES, MAX_LOGO_BYTES } from "@/lib/company/logo";
import { profilSchema } from "@/lib/company/schemas";
import { lokasiSchema } from "@/lib/onboarding/schemas";
import { createClient } from "@/lib/supabase/server";

const SAVE_FAILED = "Gagal menyimpan. Periksa koneksi internet, lalu coba lagi.";

export type PengaturanState = { message?: string; saved?: boolean };

const modeSchema = z.enum(["masuk", "masuk_pulang"], {
  error: "Pilih cara absen: masuk saja, atau masuk dan pulang.",
});

export async function simpanModeAbsen(
  _prev: PengaturanState,
  formData: FormData,
): Promise<PengaturanState> {
  const owner = await requireOwner();
  if (owner.role !== "owner") {
    return { message: "Hanya owner yang bisa mengubah pengaturan absen." };
  }

  const parsed = modeSchema.safeParse(formData.get("attendanceMode"));
  if (!parsed.success) return { message: parsed.error.issues[0]?.message };

  const supabase = await createClient();
  const { error } = await supabase
    .from("companies")
    .update({ attendance_mode: parsed.data })
    .eq("id", owner.companyId);
  if (error) {
    console.error("[simpanModeAbsen]", error);
    return { message: SAVE_FAILED };
  }

  revalidatePath("/owner/pengaturan");
  return { saved: true };
}

// -----------------------------------------------------------------------------
// Profil usaha: semua anggota usaha (owner dan admin) boleh mengubah.
// -----------------------------------------------------------------------------

export type ProfilState = { errors?: Record<string, string>; message?: string; saved?: boolean };
export type LogoState = { message?: string; saved?: "diganti" | "dihapus" };

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function revalidateProfil() {
  // Nama dan logo tampil di menu owner dan aplikasi karyawan.
  revalidatePath("/owner", "layout");
  revalidatePath("/app", "layout");
}

export async function simpanProfil(_prev: ProfilState, formData: FormData): Promise<ProfilState> {
  const owner = await requireOwner();

  const parsed = profilSchema.safeParse({
    name: text(formData, "name"),
    businessType: text(formData, "businessType"),
    city: text(formData, "city"),
    timezone: text(formData, "timezone"),
    address: text(formData, "address"),
    businessPhone: text(formData, "businessPhone"),
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const input = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_company_profile", {
    p_company_id: owner.companyId,
    p_name: input.name,
    p_business_type: input.businessType,
    p_city: input.city,
    p_timezone: input.timezone,
    p_address: input.address || null,
    p_phone: input.businessPhone,
  });
  if (error) {
    if (error.code !== "P0001" && error.code !== "42501") console.error("[simpanProfil]", error);
    return { message: error.code === "P0001" || error.code === "42501" ? error.message : SAVE_FAILED };
  }

  revalidateProfil();
  return { saved: true };
}

const LOGO_EXT: Record<string, string> = { "image/webp": "webp", "image/jpeg": "jpg", "image/png": "png" };

export async function simpanLogo(_prev: LogoState, formData: FormData): Promise<LogoState> {
  const owner = await requireOwner();
  const supabase = await createClient();

  if (formData.get("hapus") === "1") {
    const { data: oldPath, error } = await supabase.rpc("set_company_logo", {
      p_company_id: owner.companyId,
      p_logo_path: null,
    });
    if (error) {
      if (error.code !== "P0001" && error.code !== "42501") console.error("[simpanLogo] hapus", error);
      return { message: error.code === "P0001" || error.code === "42501" ? error.message : SAVE_FAILED };
    }
    if (oldPath) await supabase.storage.from(LOGO_BUCKET).remove([oldPath]);
    revalidateProfil();
    return { saved: "dihapus" };
  }

  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0) {
    return { message: "Pilih gambar logo dulu." };
  }
  const ext = LOGO_EXT[file.type];
  if (!ext || !(LOGO_TYPES as readonly string[]).includes(file.type)) {
    return { message: "Format logo harus JPG, PNG, atau WebP." };
  }
  if (file.size > MAX_LOGO_BYTES) {
    return { message: "Ukuran logo maksimal 200 KB. Pilih gambar lain." };
  }

  // Nama file baru tiap ganti logo, supaya cache tidak menampilkan logo lama.
  const path = `${owner.companyId}/logo-${Date.now()}.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from(LOGO_BUCKET)
    .upload(path, file, { contentType: file.type, cacheControl: "31536000", upsert: false });
  if (uploadError) {
    console.error("[simpanLogo] upload", uploadError);
    return { message: "Gagal mengunggah logo. Periksa koneksi internet, lalu coba lagi." };
  }

  const { data: oldPath, error } = await supabase.rpc("set_company_logo", {
    p_company_id: owner.companyId,
    p_logo_path: path,
  });
  if (error) {
    await supabase.storage.from(LOGO_BUCKET).remove([path]);
    if (error.code !== "P0001" && error.code !== "42501") console.error("[simpanLogo]", error);
    return { message: error.code === "P0001" || error.code === "42501" ? error.message : SAVE_FAILED };
  }
  if (oldPath && oldPath !== path) await supabase.storage.from(LOGO_BUCKET).remove([oldPath]);

  revalidateProfil();
  return { saved: "diganti" };
}

// -----------------------------------------------------------------------------
// Lokasi absen: owner dan admin. Perubahan tercatat di audit_logs (trigger).
// -----------------------------------------------------------------------------

export type LokasiState = { errors?: Record<string, string>; message?: string; saved?: boolean };

export async function simpanLokasiAbsen(_prev: LokasiState, formData: FormData): Promise<LokasiState> {
  const owner = await requireOwner();

  const parsed = lokasiSchema.safeParse({
    name: text(formData, "name"),
    latitude: text(formData, "latitude"),
    longitude: text(formData, "longitude"),
    radiusM: text(formData, "radiusM"),
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const locationId = text(formData, "locationId");
  const supabase = await createClient();
  const { error } = await supabase.rpc("save_location", {
    p_company_id: owner.companyId,
    p_location_id: /^[0-9a-f-]{36}$/i.test(locationId) ? locationId : null,
    p_name: parsed.data.name,
    p_latitude: parsed.data.latitude,
    p_longitude: parsed.data.longitude,
    p_radius_m: parsed.data.radiusM,
  });
  if (error) {
    if (error.code !== "P0001" && error.code !== "42501") console.error("[simpanLokasiAbsen]", error);
    return { message: error.code === "P0001" || error.code === "42501" ? error.message : SAVE_FAILED };
  }

  revalidatePath("/owner/pengaturan");
  revalidatePath("/owner");
  revalidatePath("/app", "layout");
  return { saved: true };
}
