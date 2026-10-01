"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOwner } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

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
    return { message: "Gagal menyimpan. Periksa koneksi internet, lalu coba lagi." };
  }

  revalidatePath("/owner/pengaturan");
  return { saved: true };
}
