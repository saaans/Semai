"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { fieldErrors } from "@/lib/auth/schemas";
import { requireOwner } from "@/lib/auth/session";
import { cancelCashAdvanceSchema, cashAdvanceSchema } from "@/lib/payroll/rules";
import { createClient } from "@/lib/supabase/server";

export type KasbonState = { errors?: Record<string, string>; message?: string; saved?: boolean };

const SAVE_FAILED = "Gagal menyimpan. Periksa koneksi internet, lalu coba lagi.";

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

async function requirePayrollOwner() {
  const owner = await requireOwner();
  if (!owner.onboardingCompleted) redirect("/owner/onboarding");
  return owner;
}

function rpcMessage(where: string, error: { code?: string; message: string }) {
  if (error.code === "P0001" || error.code === "42501") return error.message;
  console.error(`[${where}]`, error);
  return SAVE_FAILED;
}

export async function tambahKasbon(_prev: KasbonState, formData: FormData): Promise<KasbonState> {
  const owner = await requirePayrollOwner();
  const parsed = cashAdvanceSchema.safeParse({
    employeeId: text(formData, "employeeId"),
    amount: text(formData, "amount"),
    installment: text(formData, "installment"),
    givenOn: text(formData, "givenOn"),
    note: text(formData, "note"),
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const input = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("add_cash_advance", {
    p_company_id: owner.companyId,
    p_employee_id: input.employeeId,
    p_amount: input.amount,
    p_installment: input.installment,
    p_given_on: input.givenOn,
    p_note: input.note || null,
  });
  if (error) {
    if (error.hint === "cicilan_tidak_valid") return { errors: { installment: error.message } };
    if (error.hint === "nominal_tidak_valid") return { errors: { amount: error.message } };
    if (error.hint === "tanggal_depan") return { errors: { givenOn: error.message } };
    return { message: rpcMessage("tambahKasbon", error) };
  }

  revalidatePath("/owner/kasbon");
  revalidatePath("/owner/gaji", "layout");
  return { saved: true };
}

export async function batalkanKasbon(_prev: KasbonState, formData: FormData): Promise<KasbonState> {
  await requirePayrollOwner();
  const parsed = cancelCashAdvanceSchema.safeParse({
    cashAdvanceId: text(formData, "cashAdvanceId"),
    reason: text(formData, "reason"),
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_cash_advance", {
    p_cash_advance_id: parsed.data.cashAdvanceId,
    p_reason: parsed.data.reason,
  });
  if (error) {
    if (error.hint === "alasan_kosong" || error.hint === "alasan_panjang") return { errors: { reason: error.message } };
    return { message: rpcMessage("batalkanKasbon", error) };
  }

  revalidatePath("/owner/kasbon");
  revalidatePath("/owner/gaji", "layout");
  return { saved: true };
}
