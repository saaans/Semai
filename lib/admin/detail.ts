/**
 * Detail usaha untuk super admin, dari RPC admin_company_detail(). Hanya
 * profil usaha, kontak owner, paket, dan angka pemakaian. Tidak ada data
 * pribadi karyawan (nama, foto, lokasi, nominal gaji).
 */

import { z } from "zod";

const ts = z.string().nullable();
const n = z.number().int().nonnegative();

const detailSchema = z.object({
  company: z.object({
    id: z.string(),
    name: z.string().nullable(),
    business_type: z.string().nullable(),
    city: z.string().nullable(),
    timezone: z.string(),
    employee_range: z.string().nullable(),
    created_at: z.string(),
    onboarding_completed_at: ts,
    last_active_at: ts,
    suspended_at: ts,
    suspend_reason: z.string().nullable(),
    discount_percent: z.number().int().nullable(),
    discount_until: ts,
    discount_reason: z.string().nullable(),
    discount_active: z.boolean(),
  }),
  owner: z
    .object({ name: z.string().nullable(), email: z.string().nullable(), phone: z.string().nullable() })
    .nullable(),
  plan: z.object({
    plan_code: z.string(),
    plan_name: z.string().nullable(),
    billing_state: z.string(),
    subscription: z
      .object({
        id: z.string(),
        plan_code: z.string(),
        status: z.string(),
        billing_cycle: z.string(),
        trial_ends_at: ts,
        current_period_start: ts,
        current_period_end: ts,
        price_override: z.number().nullable(),
        provider: z.string().nullable(),
        mrr: z.number().nullable(),
      })
      .nullable(),
    trial_used: z.boolean(),
  }),
  usage: z.object({
    employees_active: n,
    employees_invited: n,
    employees_inactive: n,
    employees_hidden: n,
    locations: n,
    admins: n,
    attendances_7d: n,
    attendances_30d: n,
    attendances_total: n,
    last_attendance_at: ts,
    payroll_runs: n,
    payroll_locked: n,
    last_payroll_period: ts,
  }),
});

export type CompanyDetail = z.infer<typeof detailSchema>;

/** null kalau usaha tidak ditemukan. */
export function parseCompanyDetail(raw: unknown): CompanyDetail | null {
  if (raw === null || raw === undefined) return null;
  return detailSchema.parse(raw);
}
