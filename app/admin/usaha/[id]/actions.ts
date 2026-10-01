"use server";

import { revalidatePath } from "next/cache";
import {
  endOfDayWib,
  fieldErrors,
  parseRupiahInput,
  removeDiscountSchema,
  setDiscountSchema,
  extendTrialSchema,
  setPlanSchema,
  setSuspendedSchema,
} from "@/lib/admin/schemas";
import { requirePlatformAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

/**
 * Aksi super admin di detail usaha. Hak akses dan aturan dicek ulang di
 * RPC admin_* (is_platform_admin, alasan wajib, audit_logs).
 */

export type AdminActionState = {
  ok?: boolean;
  message?: string;
  errors?: Record<string, string>;
};

const SAVE_FAILED = "Gagal menyimpan. Periksa koneksi internet, lalu coba lagi.";

function rpcMessage(where: string, error: { code?: string; message: string }): AdminActionState {
  if (error.code === "P0001" || error.code === "42501") return { message: error.message };
  console.error(`[admin] ${where}`, error);
  return { message: SAVE_FAILED };
}

function str(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === "string" ? value : undefined;
}

function done(companyId: string): AdminActionState {
  revalidatePath(`/admin/usaha/${companyId}`);
  revalidatePath("/admin", "layout");
  return { ok: true };
}

export async function ubahPaket(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  await requirePlatformAdmin();
  const planCode = str(formData, "planCode");
  const parsed = setPlanSchema.safeParse({
    companyId: str(formData, "companyId"),
    planCode,
    cycle: planCode === "benih" ? "bulanan" : str(formData, "cycle"),
    periodEnd: str(formData, "periodEnd") || undefined,
    price: parseRupiahInput(str(formData, "price")),
    reason: str(formData, "reason"),
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };
  const v = parsed.data;
  const benih = v.planCode === "benih";

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_plan", {
    p_company_id: v.companyId,
    p_plan_code: v.planCode,
    p_cycle: benih ? null : v.cycle,
    p_period_end: benih || !v.periodEnd ? null : endOfDayWib(v.periodEnd),
    p_price: benih ? null : v.price,
    p_reason: v.reason,
  });
  if (error) return rpcMessage("ubahPaket", error);
  return done(v.companyId);
}

export async function perpanjangTrial(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  await requirePlatformAdmin();
  const parsed = extendTrialSchema.safeParse({
    companyId: str(formData, "companyId"),
    days: str(formData, "days"),
    reason: str(formData, "reason"),
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_extend_trial", {
    p_company_id: parsed.data.companyId,
    p_days: parsed.data.days,
    p_reason: parsed.data.reason,
  });
  if (error) return rpcMessage("perpanjangTrial", error);
  return done(parsed.data.companyId);
}

export async function aturDiskon(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  await requirePlatformAdmin();
  const parsed = setDiscountSchema.safeParse({
    companyId: str(formData, "companyId"),
    percent: str(formData, "percent"),
    until: str(formData, "until") || null,
    reason: str(formData, "reason"),
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_discount", {
    p_company_id: parsed.data.companyId,
    p_percent: parsed.data.percent,
    p_until: parsed.data.until ? endOfDayWib(parsed.data.until) : null,
    p_reason: parsed.data.reason,
  });
  if (error) return rpcMessage("aturDiskon", error);
  return done(parsed.data.companyId);
}

export async function hapusDiskon(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  await requirePlatformAdmin();
  const parsed = removeDiscountSchema.safeParse({
    companyId: str(formData, "companyId"),
    reason: str(formData, "reason"),
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_discount", {
    p_company_id: parsed.data.companyId,
    p_percent: null,
    p_until: null,
    p_reason: parsed.data.reason,
  });
  if (error) return rpcMessage("hapusDiskon", error);
  return done(parsed.data.companyId);
}

export async function ubahSuspend(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  await requirePlatformAdmin();
  const parsed = setSuspendedSchema.safeParse({
    companyId: str(formData, "companyId"),
    suspended: str(formData, "suspended"),
    reason: str(formData, "reason"),
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_suspended", {
    p_company_id: parsed.data.companyId,
    p_suspended: parsed.data.suspended,
    p_reason: parsed.data.reason,
  });
  if (error) return rpcMessage("ubahSuspend", error);
  return done(parsed.data.companyId);
}
