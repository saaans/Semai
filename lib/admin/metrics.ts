/**
 * Angka dashboard super admin. Data mentah dari RPC admin_dashboard_metrics();
 * file ini hanya memeriksa bentuknya dan menghitung persentase.
 *
 * Definisi (dihitung di database):
 * - Terdaftar: usaha yang selesai onboarding dan tidak diarsip.
 * - Aktif mingguan: ada minimal 1 absen dalam 7 hari terakhir.
 * - MRR: langganan berbayar active/past_due yang belum lewat tenggang 7 hari,
 *   tahunan dibagi 12, sesudah diskon. Trial tidak dihitung.
 * - Churn 30 hari: membayar 30 hari lalu, tidak membayar sekarang, dibagi
 *   yang membayar 30 hari lalu.
 * - Konversi: pernah membayar dibagi usaha terdaftar. Trial → bayar: dari
 *   usaha yang trialnya sudah selesai.
 */

import { z } from "zod";

const count = z.number().int().nonnegative();

const metricsSchema = z.object({
  registered: count,
  new_30d: count,
  active_7d: count,
  paying: count,
  trialing: count,
  mrr: z.number().nonnegative(),
  mrr_custom_unpriced: count,
  churn_base: count,
  churned: count,
  ever_paid: count,
  trial_done: count,
  trial_paid: count,
  per_plan: z.array(
    z.object({
      plan_code: z.string(),
      name: z.string(),
      tier: z.string(),
      companies: count,
      trialing: count,
    }),
  ),
});

export type RawMetrics = z.infer<typeof metricsSchema>;

export type DashboardMetrics = RawMetrics & {
  /** 0–1, null kalau pembaginya 0. */
  activeRate: number | null;
  churnRate: number | null;
  conversionRate: number | null;
  trialConversionRate: number | null;
};

export function ratio(part: number, whole: number): number | null {
  return whole > 0 ? part / whole : null;
}

export function parseMetrics(raw: unknown): DashboardMetrics {
  const m = metricsSchema.parse(raw);
  return {
    ...m,
    activeRate: ratio(m.active_7d, m.registered),
    churnRate: ratio(m.churned, m.churn_base),
    conversionRate: ratio(m.ever_paid, m.registered),
    trialConversionRate: ratio(m.trial_paid, m.trial_done),
  };
}

/** 0.1234 → "12%", 0.045 → "4,5%", null → "–". */
export function formatPercent(value: number | null): string {
  if (value === null) return "–";
  const pct = value * 100;
  const digits = pct === 0 || pct >= 10 ? 0 : 1;
  return `${pct.toLocaleString("id-ID", { maximumFractionDigits: digits, minimumFractionDigits: 0 })}%`;
}
