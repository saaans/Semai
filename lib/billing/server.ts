import "server-only";
import { cache } from "react";
import { isLevel, type Level } from "@/lib/plans";
import { createClient } from "@/lib/supabase/server";
import type { PlanRow } from "./catalog";
import { isBillingState, type BillingState } from "./state";

export type BillingOverview = {
  planCode: string;
  planName: string;
  level: Level;
  /** trialing | active | past_due, null di Benih. */
  status: string | null;
  billingCycle: string | null;
  state: BillingState;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  /** Usaha ini pernah punya langganan (trial hanya sekali). */
  trialUsed: boolean;
  /** Karyawan aktif + diundang, termasuk yang disembunyikan. */
  employeesUsed: number;
  /** null = tanpa batas. */
  employeeLimit: number | null;
  hiddenCount: number;
  overLimitSince: string | null;
};

/**
 * Rapikan status langganan (trial habis, periode lewat) dan batas karyawan.
 * Idempoten; gagal tidak menghentikan halaman karena status tagihan juga
 * dihitung dari waktu di database.
 */
const syncPlanState = cache(async (companyId: string) => {
  const supabase = await createClient();
  const { error } = await supabase.rpc("sync_plan_state", { p_company_id: companyId });
  if (error) console.error("[syncPlanState]", error);
});

/** Paket, status tagihan, dan kuota usaha. Sekali per request. */
export const getBillingOverview = cache(async (companyId: string): Promise<BillingOverview> => {
  await syncPlanState(companyId);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_billing_overview", { p_company_id: companyId });
  const row = data?.[0];
  if (error || !row) {
    console.error("[getBillingOverview]", error);
    throw new Error("Gagal memuat paket usaha. Coba muat ulang halaman.");
  }
  return {
    planCode: row.plan_code,
    planName: row.plan_name,
    level: isLevel(row.level) ? row.level : "benih",
    status: row.subscription_status,
    billingCycle: row.billing_cycle,
    state: isBillingState(row.billing_state) ? row.billing_state : "normal",
    trialEndsAt: row.trial_ends_at,
    currentPeriodEnd: row.current_period_end,
    trialUsed: row.trial_used,
    employeesUsed: row.employees_used,
    employeeLimit: row.employee_limit,
    hiddenCount: row.hidden_count,
    overLimitSince: row.over_limit_since,
  };
});

/** Semua paket aktif, urut dari kecil ke besar. */
export const getPlans = cache(async (): Promise<PlanRow[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("plans")
    .select("code, tier, level, name, min_employees, max_employees, price_monthly, price_yearly, sort_order")
    .eq("is_active", true)
    .order("sort_order");
  if (error) {
    console.error("[getPlans]", error);
    throw new Error("Gagal memuat daftar paket. Coba muat ulang halaman.");
  }
  return data;
});
