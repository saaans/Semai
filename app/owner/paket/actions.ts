"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOwner, safeNextPath } from "@/lib/auth/session";
import { QUOTA_DISMISS_COOKIE } from "@/lib/billing/state";
import { createClient } from "@/lib/supabase/server";

export type PaketState = { message?: string };

const SAVE_FAILED = "Gagal menyimpan. Periksa koneksi internet, lalu coba lagi.";

async function requirePlanOwner() {
  const owner = await requireOwner();
  if (!owner.onboardingCompleted) redirect("/owner/onboarding");
  return owner;
}

function rpcMessage(where: string, error: { code?: string; message: string }) {
  if (error.code === "P0001" || error.code === "42501") return error.message;
  console.error(`[${where}]`, error);
  return SAVE_FAILED;
}

/** Mulai trial Plus 14 hari, lalu kembali ke halaman asal. */
export async function mulaiTrialPlus(_prev: PaketState, formData: FormData): Promise<PaketState> {
  const owner = await requirePlanOwner();
  if (owner.role !== "owner") return { message: "Hanya owner yang bisa memulai trial." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("start_trial_plus", { p_company_id: owner.companyId });
  if (error) return { message: rpcMessage("mulaiTrialPlus", error) };

  revalidatePath("/owner", "layout");
  const next = formData.get("next");
  redirect(safeNextPath(typeof next === "string" ? next : null) ?? "/owner/paket?trial=mulai");
}

/** Hentikan langganan berjalan dan pakai Benih. */
export async function turunKeBenih(): Promise<PaketState> {
  const owner = await requirePlanOwner();
  if (owner.role !== "owner") return { message: "Hanya owner yang bisa mengubah paket." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("downgrade_to_benih", { p_company_id: owner.companyId });
  if (error) return { message: rpcMessage("turunKeBenih", error) };

  revalidatePath("/owner", "layout");
  redirect("/owner/paket?benih=1");
}

export async function tutupKartuKuota(): Promise<void> {
  await requirePlanOwner();
  const store = await cookies();
  store.set(QUOTA_DISMISS_COOKIE, "1", {
    maxAge: 7 * 24 * 60 * 60,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/owner",
  });
  revalidatePath("/owner");
}
