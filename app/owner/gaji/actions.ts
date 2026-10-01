"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { localDate } from "@/lib/attendance/dates";
import { fieldErrors } from "@/lib/auth/schemas";
import { requireOwner } from "@/lib/auth/session";
import { monthPeriod } from "@/lib/payroll/attendance";
import {
  adjustmentSchema,
  baseSalarySchema,
  deleteRuleSchema,
  ruleSchema,
  settingsSchema,
} from "@/lib/payroll/rules";
import { buildPayrollPreview, getPayrollCompany, lockPayload } from "@/lib/payroll/server";
import { createClient } from "@/lib/supabase/server";

export type FormState = { errors?: Record<string, string>; message?: string; saved?: boolean };

const SAVE_FAILED = "Gagal menyimpan. Periksa koneksi internet, lalu coba lagi.";
const OWNER_ONLY = "Hanya pemilik usaha yang bisa mengatur gaji dan memproses gajian.";

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

/** Owner saja. Admin (paket Plus) tidak mengelola gaji. */
async function requirePayrollOwner() {
  const owner = await requireOwner();
  if (!owner.onboardingCompleted) redirect("/owner/onboarding");
  return owner;
}

type RpcError = { code?: string; hint?: string; message: string };

/** Pesan dari RPC (P0001/42501) ditampilkan apa adanya; selain itu pesan umum. */
function rpcMessage(where: string, error: RpcError): string {
  if (error.code === "P0001" || error.code === "42501") return error.message;
  console.error(`[${where}]`, error);
  return SAVE_FAILED;
}

function revalidateGaji() {
  revalidatePath("/owner/gaji", "layout");
}

export async function simpanGajiPokok(_prev: FormState, formData: FormData): Promise<FormState> {
  const owner = await requirePayrollOwner();
  if (owner.role !== "owner") return { message: OWNER_ONLY };

  const parsed = baseSalarySchema.safeParse({
    employeeId: text(formData, "employeeId"),
    amount: text(formData, "amount"),
    reason: text(formData, "reason"),
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_base_salary", {
    p_employee_id: parsed.data.employeeId,
    p_amount: parsed.data.amount,
    p_reason: parsed.data.reason,
  });
  if (error) {
    if (error.hint === "alasan_kosong" || error.hint === "alasan_panjang") return { errors: { reason: error.message } };
    if (error.hint === "nominal_tidak_valid" || error.hint === "tidak_berubah") return { errors: { amount: error.message } };
    return { message: rpcMessage("simpanGajiPokok", error) };
  }

  revalidateGaji();
  revalidatePath("/owner/karyawan", "layout");
  return { saved: true };
}

export async function simpanAturan(_prev: FormState, formData: FormData): Promise<FormState> {
  const owner = await requirePayrollOwner();
  if (owner.role !== "owner") return { message: OWNER_ONLY };

  const parsed = ruleSchema.safeParse({
    ruleId: text(formData, "ruleId"),
    kind: text(formData, "kind"),
    name: text(formData, "name"),
    calc: text(formData, "calc"),
    triggerEvent: text(formData, "triggerEvent"),
    amount: text(formData, "amount"),
    employeeId: text(formData, "employeeId"),
    isActive: formData.get("isActive") === "on",
    reason: text(formData, "reason"),
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const input = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("save_payroll_rule", {
    p_company_id: owner.companyId,
    p_rule_id: input.ruleId,
    p_employee_id: input.employeeId,
    p_kind: input.kind,
    p_name: input.name,
    p_calc: input.calc,
    p_amount: input.amount,
    p_trigger_event: input.triggerEvent,
    p_is_active: input.isActive,
    p_reason: input.reason,
  });
  if (error) {
    if (error.hint === "alasan_kosong" || error.hint === "alasan_panjang") return { errors: { reason: error.message } };
    if (error.hint === "nama_kosong") return { errors: { name: error.message } };
    if (error.hint === "nominal_tidak_valid") return { errors: { amount: error.message } };
    return { message: rpcMessage("simpanAturan", error) };
  }

  revalidateGaji();
  return { saved: true };
}

export async function hapusAturan(_prev: FormState, formData: FormData): Promise<FormState> {
  const owner = await requirePayrollOwner();
  if (owner.role !== "owner") return { message: OWNER_ONLY };

  const parsed = deleteRuleSchema.safeParse({ ruleId: text(formData, "ruleId"), reason: text(formData, "reason") });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_payroll_rule", {
    p_rule_id: parsed.data.ruleId,
    p_reason: parsed.data.reason,
  });
  if (error) {
    if (error.hint === "alasan_kosong" || error.hint === "alasan_panjang") return { errors: { reason: error.message } };
    return { message: rpcMessage("hapusAturan", error) };
  }

  revalidateGaji();
  return { saved: true };
}

export async function simpanPengaturan(_prev: FormState, formData: FormData): Promise<FormState> {
  const owner = await requirePayrollOwner();
  if (owner.role !== "owner") return { message: OWNER_ONLY };

  const parsed = settingsSchema.safeParse({
    dayBasis: text(formData, "dayBasis"),
    fixedDays: text(formData, "fixedDays") || "26",
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_payroll_settings", {
    p_company_id: owner.companyId,
    p_day_basis: parsed.data.dayBasis,
    p_fixed_days: parsed.data.fixedDays,
  });
  if (error) return { message: rpcMessage("simpanPengaturan", error) };

  revalidateGaji();
  return { saved: true };
}

export async function tambahPenyesuaian(_prev: FormState, formData: FormData): Promise<FormState> {
  const owner = await requirePayrollOwner();
  if (owner.role !== "owner") return { message: OWNER_ONLY };

  const parsed = adjustmentSchema.safeParse({
    employeeId: text(formData, "employeeId"),
    month: text(formData, "month"),
    direction: text(formData, "direction"),
    amount: text(formData, "amount"),
    reason: text(formData, "reason"),
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const input = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("add_payroll_adjustment", {
    p_company_id: owner.companyId,
    p_employee_id: input.employeeId,
    p_period_start: monthPeriod(input.month).start,
    p_amount: input.direction === "kurang" ? -input.amount : input.amount,
    p_reason: input.reason,
  });
  if (error) {
    if (error.hint === "alasan_kosong" || error.hint === "alasan_panjang") return { errors: { reason: error.message } };
    if (error.hint === "nominal_tidak_valid") return { errors: { amount: error.message } };
    return { message: rpcMessage("tambahPenyesuaian", error) };
  }

  revalidateGaji();
  return { saved: true };
}

export async function hapusPenyesuaian(_prev: FormState, formData: FormData): Promise<FormState> {
  const owner = await requirePayrollOwner();
  if (owner.role !== "owner") return { message: OWNER_ONLY };

  const adjustmentId = text(formData, "adjustmentId");
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_payroll_adjustment", { p_adjustment_id: adjustmentId });
  if (error) return { message: rpcMessage("hapusPenyesuaian", error) };

  revalidateGaji();
  return { saved: true };
}

/**
 * Kunci gajian. Gaji dihitung ulang dari data terbaru; kalau total berbeda
 * dari pratinjau yang dilihat owner, kunci dibatalkan supaya owner tidak
 * mengunci angka yang belum dia lihat.
 */
export async function kunciGajian(_prev: FormState, formData: FormData): Promise<FormState> {
  const owner = await requirePayrollOwner();
  if (owner.role !== "owner") return { message: OWNER_ONLY };

  const month = text(formData, "month");
  const expectedNet = Number(text(formData, "expectedNet"));
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || !Number.isSafeInteger(expectedNet)) {
    return { message: "Data gajian tidak lengkap. Muat ulang halaman lalu coba lagi." };
  }

  const company = await getPayrollCompany(owner.companyId);
  const today = localDate(new Date(), company.timezone);
  const preview = await buildPayrollPreview(owner.companyId, company, month, today);

  if (preview.employees.length === 0) return { message: "Belum ada karyawan untuk digaji bulan ini." };
  const negative = preview.employees.find((e) => e.result.negative);
  if (negative) {
    return {
      message: `Penyesuaian minus ${negative.name} lebih besar dari gajinya. Ubah penyesuaiannya dulu.`,
    };
  }
  if (preview.totals.net !== expectedNet) {
    return {
      message: "Ada perubahan absen, aturan, atau kasbon sejak pratinjau dibuka. Periksa angka terbaru di bawah, lalu kunci lagi.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("lock_payroll_run", {
    p_company_id: owner.companyId,
    p_period_start: preview.period.start,
    p_slips: lockPayload(preview),
  });
  if (error) return { message: rpcMessage("kunciGajian", error) };

  revalidateGaji();
  revalidatePath("/owner/absen", "layout");
  revalidatePath("/owner/kasbon");
  return { saved: true };
}

/** Catat bahwa slip sudah dikirim lewat wa.me. Gagal tidak menghalangi kirim. */
export async function tandaiWaTerkirim(payslipId: string): Promise<void> {
  const owner = await requirePayrollOwner();
  if (owner.role !== "owner") return;
  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_payslip_wa_sent", { p_payslip_id: payslipId });
  if (error) {
    console.error("[tandaiWaTerkirim]", error);
    return;
  }
  revalidateGaji();
}
