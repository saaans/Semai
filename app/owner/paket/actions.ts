"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOwner, safeNextPath } from "@/lib/auth/session";
import { getSiteUrl } from "@/lib/auth/site-url";
import { isBillingCycle } from "@/lib/billing/catalog";
import { createSnapTransaction, getMidtransConfig } from "@/lib/billing/midtrans";
import { QUOTA_DISMISS_COOKIE } from "@/lib/billing/state";
import { createAdminClient } from "@/lib/supabase/admin";
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

const KIND_LABEL: Record<string, string> = { baru: "", upgrade: " (upgrade)", perpanjang: " (perpanjang)" };

/**
 * Buat tagihan di database lalu arahkan ke halaman bayar Midtrans. Nominal
 * selalu dihitung database; form hanya mengirim kode paket dan siklus.
 */
export async function bayarPaket(_prev: PaketState, formData: FormData): Promise<PaketState> {
  const owner = await requirePlanOwner();
  if (owner.role !== "owner") return { message: "Hanya owner yang bisa membayar paket." };

  const planCode = formData.get("planCode");
  const cycle = formData.get("cycle");
  if (typeof planCode !== "string" || !planCode || !isBillingCycle(cycle)) {
    return { message: "Pilihan paket tidak valid. Muat ulang halaman lalu coba lagi." };
  }

  const config = getMidtransConfig();
  if (!config) {
    return { message: "Pembayaran online belum aktif. Hubungi tim Semai untuk mengaktifkan paket." };
  }

  const supabase = await createClient();
  const { data: invoice, error } = await supabase.rpc("create_checkout_invoice", {
    p_company_id: owner.companyId,
    p_plan_code: planCode,
    p_cycle: cycle,
  });
  if (error || !invoice) return { message: error ? rpcMessage("bayarPaket", error) : SAVE_FAILED };

  // Upgrade yang tertutup penuh sisa paket lama langsung aktif, tanpa bayar.
  if (invoice.status === "paid") {
    revalidatePath("/owner", "layout");
    redirect(`/owner/paket?tagihan=${encodeURIComponent(invoice.number)}`);
  }

  let checkoutUrl = invoice.checkout_url;
  if (!checkoutUrl) {
    const [{ data: company }, { data: plan }, site] = await Promise.all([
      supabase.from("companies").select("name, phone").eq("id", owner.companyId).maybeSingle(),
      supabase.from("plans").select("name").eq("code", planCode).maybeSingle(),
      getSiteUrl(),
    ]);
    try {
      checkoutUrl = await createSnapTransaction(config, {
        orderId: invoice.number,
        amount: invoice.amount,
        itemId: planCode,
        itemName: `Semai ${plan?.name ?? planCode} ${cycle}${KIND_LABEL[invoice.kind ?? ""] ?? ""}`,
        customer: { name: company?.name ?? "Owner Semai", email: owner.email, phone: owner.phone },
        finishUrl: `${site}/owner/paket?tagihan=${encodeURIComponent(invoice.number)}`,
      });
    } catch {
      return { message: "Halaman bayar Midtrans gagal dibuat. Coba lagi beberapa saat lagi." };
    }
    const { error: saveError } = await createAdminClient().rpc("set_invoice_checkout", {
      p_invoice_id: invoice.id,
      p_checkout_url: checkoutUrl,
    });
    if (saveError) console.error("[bayarPaket] simpan link bayar", saveError);
  }

  redirect(checkoutUrl);
}
