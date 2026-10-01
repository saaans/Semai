/**
 * Status langganan dan kuota. Fungsi murni (aman di client) yang meniru
 * company_billing_state() dan apply_employee_limit() di database untuk
 * teks di UI. Pengecekan resmi tetap di database.
 */

export const BILLING_STATES = ["normal", "tenggang", "baca_saja"] as const;
export type BillingState = (typeof BILLING_STATES)[number];

/** Tenggang tagihan belum dibayar sebelum fitur owner jadi baca saja. */
export const PAYMENT_GRACE_DAYS = 7;
/** Tenggang karyawan di atas batas paket sebelum disembunyikan. */
export const OVER_LIMIT_GRACE_DAYS = 14;
/** Peringatan trial mulai muncul di banner owner. */
export const TRIAL_WARNING_DAYS = 3;

/** Kartu kuota di dashboard yang ditutup tidak muncul lagi selama 7 hari. */
export const QUOTA_DISMISS_COOKIE = "semai_tutup_kuota";

const DAY_MS = 24 * 60 * 60 * 1000;

export function isBillingState(value: unknown): value is BillingState {
  return typeof value === "string" && (BILLING_STATES as readonly string[]).includes(value);
}

export function addDays(value: string | Date, days: number): Date {
  return new Date(new Date(value).getTime() + days * DAY_MS);
}

/** Sisa hari (dibulatkan ke atas), 0 kalau sudah lewat. */
export function daysLeft(until: string | Date, now: Date = new Date()): number {
  const diff = new Date(until).getTime() - now.getTime();
  return diff <= 0 ? 0 : Math.ceil(diff / DAY_MS);
}

/** Sama dengan company_billing_state() di database. */
export function billingStateAt(
  subscription: { status: string | null; currentPeriodEnd: string | null } | null,
  now: Date = new Date(),
): BillingState {
  if (!subscription || !subscription.status || subscription.status === "trialing" || !subscription.currentPeriodEnd) {
    return "normal";
  }
  const end = new Date(subscription.currentPeriodEnd);
  if (now < end) return "normal";
  if (now < addDays(end, PAYMENT_GRACE_DAYS)) return "tenggang";
  return "baca_saja";
}

export type QuotaTone = "aman" | "hampir" | "penuh" | "lewat";

export type QuotaStatus = {
  /** "4 dari 5 karyawan terpakai". */
  text: string;
  tone: QuotaTone;
  /** Sisa kursi, 0 kalau penuh atau lewat. */
  remaining: number;
};

/** Kuota karyawan (aktif + diundang). null = paket tanpa batas. */
export function quotaStatus(used: number, limit: number | null): QuotaStatus | null {
  if (limit === null) return null;
  const tone: QuotaTone =
    used > limit ? "lewat" : used === limit ? "penuh" : limit - used <= 1 ? "hampir" : "aman";
  return { text: `${used} dari ${limit} karyawan terpakai`, tone, remaining: Math.max(limit - used, 0) };
}

/** Peringatan kuota muncul saat sisa kursi tinggal satu atau kurang. */
export function shouldWarnQuota(status: QuotaStatus | null): status is QuotaStatus {
  return status !== null && status.tone !== "aman";
}
