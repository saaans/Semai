import "server-only";
import { createClient } from "@/lib/supabase/server";
import { parseCompanyDetail } from "./detail";
import { PAGE_SIZE, type CompanyFilters } from "./filters";
import { parseMetrics } from "./metrics";

/**
 * Data area super admin. Semua lewat client user biasa: RPC admin_* dan RLS
 * yang menolak selain is_platform_admin(), jadi tidak ada service role di sini.
 */

function fail(where: string, error: unknown): never {
  console.error(`[admin] ${where}`, error);
  throw new Error("Gagal memuat data. Coba muat ulang halaman.");
}

export async function getDashboardMetrics() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_dashboard_metrics");
  if (error) fail("metrics", error);
  return parseMetrics(data);
}

export async function listCompanies(filters: CompanyFilters) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_list_companies", {
    p_search: filters.search,
    p_business_type: filters.businessType,
    p_city: filters.city,
    p_plan: filters.plan,
    p_activity: filters.activity,
    p_limit: PAGE_SIZE,
    p_offset: (filters.page - 1) * PAGE_SIZE,
  });
  if (error) fail("listCompanies", error);
  return { rows: data, total: Number(data[0]?.total_count ?? 0) };
}

export async function listCities() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_company_cities");
  if (error) fail("cities", error);
  return data;
}

/** Paket yang bisa dipilih di filter dan form ubah paket (yang dijual). */
export async function listPlans() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("plans")
    .select("code, tier, level, name, max_employees, price_monthly, price_yearly, sort_order")
    .eq("is_active", true)
    .order("sort_order");
  if (error) fail("plans", error);
  return data;
}

export async function getCompanyDetail(companyId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_company_detail", { p_company_id: companyId });
  if (error) fail("detail", error);
  return parseCompanyDetail(data);
}

export async function getCompanyHistory(companyId: string) {
  const supabase = await createClient();
  const [audit, invoices, subscriptions] = await Promise.all([
    supabase.rpc("admin_company_audit", { p_company_id: companyId, p_limit: 50 }),
    supabase
      .from("invoices")
      .select("id, number, amount, discount_amount, credit_amount, status, kind, plan_code, billing_cycle, created_at, due_at, paid_at, payment_method")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("subscriptions")
      .select("id, plan_code, status, billing_cycle, trial_ends_at, current_period_start, current_period_end, ended_at, provider, price_override, created_at")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);
  if (audit.error) fail("audit", audit.error);
  if (invoices.error) fail("invoices", invoices.error);
  if (subscriptions.error) fail("subscriptions", subscriptions.error);
  return { audit: audit.data, invoices: invoices.data, subscriptions: subscriptions.data };
}

export const INVOICE_TABS = ["semua", "menunggu", "lunas", "gagal"] as const;
export type InvoiceTab = (typeof INVOICE_TABS)[number];

const TAB_STATUSES: Record<InvoiceTab, string[] | null> = {
  semua: null,
  menunggu: ["pending"],
  lunas: ["paid"],
  gagal: ["failed", "expired"],
};

export async function listInvoices(tab: InvoiceTab, page: number) {
  const supabase = await createClient();
  let query = supabase
    .from("invoices")
    .select(
      "id, number, company_id, amount, discount_amount, credit_amount, status, kind, plan_code, billing_cycle, provider, payment_method, created_at, due_at, paid_at, companies (name)",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  const statuses = TAB_STATUSES[tab];
  if (statuses) query = query.in("status", statuses);
  const { data, error, count } = await query;
  if (error) fail("listInvoices", error);
  return { rows: data, total: count ?? 0 };
}

export async function invoiceSummary() {
  const supabase = await createClient();
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const head = { count: "exact" as const, head: true };
  const [pending, overdue, failed, paid] = await Promise.all([
    supabase.from("invoices").select("id", head).eq("status", "pending"),
    supabase.from("invoices").select("id", head).eq("status", "pending").lt("due_at", new Date().toISOString()),
    supabase.from("invoices").select("id", head).in("status", ["failed", "expired"]).gte("created_at", since),
    supabase.from("invoices").select("amount").eq("status", "paid").gte("paid_at", since),
  ]);
  for (const r of [pending, overdue, failed, paid]) if (r.error) fail("invoiceSummary", r.error);
  return {
    pending: pending.count ?? 0,
    overdue: overdue.count ?? 0,
    failed30d: failed.count ?? 0,
    paid30d: (paid.data ?? []).reduce((sum, row) => sum + row.amount, 0),
  };
}

/** Notifikasi Midtrans yang bermasalah: tanda tangan salah atau hasil error. */
export async function listPaymentProblems() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payment_events")
    .select("id, order_id, transaction_status, signature_valid, result, created_at")
    .or(
      [
        "signature_valid.eq.false",
        "result.like.*nominal_beda",
        "result.like.*invoice_tidak_ada",
        "result.like.*status_gagal",
        "result.like.*error_database",
      ].join(","),
    )
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) fail("paymentProblems", error);
  return data;
}
