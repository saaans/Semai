"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { koreksiSchema } from "@/lib/attendance/correction";
import { fieldErrors } from "@/lib/auth/schemas";
import { requireOwner } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export type KoreksiState = { errors?: Record<string, string>; message?: string; saved?: boolean };
export type LemburState = { message?: string; decided?: "disetujui" | "ditolak" };

const SAVE_FAILED = "Gagal menyimpan. Periksa koneksi internet, lalu coba lagi.";

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

async function requireManager() {
  const owner = await requireOwner();
  if (!owner.onboardingCompleted) redirect("/owner/onboarding");
  return owner;
}

function revalidateAbsen() {
  revalidatePath("/owner");
  revalidatePath("/owner/absen", "layout");
}

export async function koreksiAbsen(_prev: KoreksiState, formData: FormData): Promise<KoreksiState> {
  const owner = await requireManager();

  const parsed = koreksiSchema.safeParse({
    employeeId: text(formData, "employeeId"),
    workDate: text(formData, "workDate"),
    status: text(formData, "status"),
    clockIn: text(formData, "clockIn"),
    clockOut: text(formData, "clockOut"),
    reason: text(formData, "reason"),
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const input = parsed.data;
  const hadir = input.status === "hadir";
  const supabase = await createClient();
  const { error } = await supabase.rpc("correct_attendance", {
    p_company_id: owner.companyId,
    p_employee_id: input.employeeId,
    p_work_date: input.workDate,
    p_status: input.status,
    p_clock_in: hadir ? input.clockIn : null,
    p_clock_out: hadir && input.clockOut ? input.clockOut : null,
    p_reason: input.reason,
  });
  if (error) {
    if (error.code !== "P0001" && error.code !== "42501") console.error("[koreksiAbsen]", error);
    if (error.hint === "alasan_kosong" || error.hint === "alasan_panjang") {
      return { errors: { reason: error.message } };
    }
    if (error.hint === "jam_masuk_kosong") return { errors: { clockIn: error.message } };
    return { message: error.code === "P0001" || error.code === "42501" ? error.message : SAVE_FAILED };
  }

  revalidateAbsen();
  return { saved: true };
}

const lemburSchema = z.object({
  attendanceId: z.uuid({ error: "Data lembur tidak dikenal. Muat ulang halaman lalu coba lagi." }),
  decision: z.enum(["setujui", "tolak"], { error: "Pilih setujui atau tolak lembur." }),
});

export async function putuskanLembur(_prev: LemburState, formData: FormData): Promise<LemburState> {
  await requireManager();

  const parsed = lemburSchema.safeParse({
    attendanceId: text(formData, "attendanceId"),
    decision: text(formData, "decision"),
  });
  if (!parsed.success) return { message: parsed.error.issues[0]?.message };

  const approve = parsed.data.decision === "setujui";
  const supabase = await createClient();
  const { error } = await supabase.rpc("decide_overtime", {
    p_attendance_id: parsed.data.attendanceId,
    p_approve: approve,
  });
  if (error) {
    if (error.code !== "P0001") console.error("[putuskanLembur]", error);
    return { message: error.code === "P0001" ? error.message : SAVE_FAILED };
  }

  revalidateAbsen();
  return { decided: approve ? "disetujui" : "ditolak" };
}
