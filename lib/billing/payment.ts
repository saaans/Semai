/**
 * Fungsi murni pembayaran: signature Midtrans, nominal, status, prorata, dan
 * jenis tagihan. Aturan resmi ada di database (create_checkout_invoice,
 * apply_payment); fungsi di sini meniru aturan itu untuk server dan UI.
 * Hanya dipakai di server (node:crypto).
 */

import { createHash, timingSafeEqual } from "node:crypto";
import { PAYMENT_GRACE_DAYS } from "./state";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Perpanjangan bisa dibayar mulai sekian hari sebelum periode berakhir. */
export const RENEWAL_WINDOW_DAYS = 7;

// -----------------------------------------------------------------------------
// Notifikasi Midtrans
// -----------------------------------------------------------------------------

/** SHA512(order_id + status_code + gross_amount + server_key), hex. */
export function midtransSignature(orderId: string, statusCode: string, grossAmount: string, serverKey: string): string {
  return createHash("sha512").update(orderId + statusCode + grossAmount + serverKey).digest("hex");
}

export type MidtransNotification = {
  order_id?: unknown;
  status_code?: unknown;
  gross_amount?: unknown;
  signature_key?: unknown;
  transaction_status?: unknown;
  fraud_status?: unknown;
  payment_type?: unknown;
  transaction_id?: unknown;
};

/** Signature notifikasi cocok dengan server key. Perbandingan waktu konstan. */
export function isValidSignature(notification: MidtransNotification, serverKey: string): boolean {
  const { order_id, status_code, gross_amount, signature_key } = notification;
  if (
    typeof order_id !== "string" ||
    typeof status_code !== "string" ||
    typeof gross_amount !== "string" ||
    typeof signature_key !== "string" ||
    !serverKey
  ) {
    return false;
  }
  const expected = Buffer.from(midtransSignature(order_id, status_code, gross_amount, serverKey), "utf8");
  const actual = Buffer.from(signature_key.toLowerCase(), "utf8");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/**
 * "39000.00" → 39000. Rupiah tidak punya sen; pecahan selain .00 dianggap
 * tidak valid supaya tidak pernah ada float untuk uang.
 */
export function parseGrossAmount(value: unknown): number | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const text = String(value).trim();
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(text);
  if (!match?.[1]) return null;
  if (match[2] && Number(match[2]) !== 0) return null;
  const amount = Number(match[1]);
  return Number.isSafeInteger(amount) ? amount : null;
}

export type PaymentOutcome = "paid" | "pending" | "expired" | "failed";

/**
 * Status transaksi Midtrans → hasil untuk invoice. null = abaikan (refund,
 * chargeback, status tidak dikenal; dicatat di payment_events saja).
 */
export function paymentOutcome(transactionStatus: unknown, fraudStatus?: unknown): PaymentOutcome | null {
  switch (transactionStatus) {
    case "settlement":
      return "paid";
    case "capture":
      return fraudStatus === "accept" || fraudStatus === undefined ? "paid" : "pending";
    case "pending":
      return "pending";
    case "expire":
      return "expired";
    case "deny":
    case "cancel":
    case "failure":
      return "failed";
    default:
      return null;
  }
}

// -----------------------------------------------------------------------------
// Nominal dan jenis tagihan
// -----------------------------------------------------------------------------

/** Sisa nilai periode berjalan (dibulatkan ke bawah), sama dengan database. */
export function prorataCredit(price: number, periodStart: Date, periodEnd: Date, now: Date): number {
  const total = periodEnd.getTime() - periodStart.getTime();
  const left = periodEnd.getTime() - now.getTime();
  if (total <= 0 || left <= 0 || price <= 0) return 0;
  return Math.min(Math.floor((price * left) / total), price);
}

export type CheckoutKind = "baru" | "upgrade" | "perpanjang";

export type CurrentPaidPlan = {
  /** trialing | active | past_due */
  status: string;
  priceMonthly: number | null;
  periodEnd: string | null;
};

export type CheckoutOption = {
  kind: CheckoutKind;
  /** Perpanjangan belum bisa dibayar sebelum tanggal ini. null = bisa sekarang. */
  opensAt: Date | null;
};

/** Jenis tagihan kalau owner memilih paket ini. Sama dengan create_checkout_invoice(). */
export function checkoutOption(
  current: CurrentPaidPlan | null,
  targetPriceMonthly: number,
  now: Date = new Date(),
): CheckoutOption {
  if (!current || current.status === "trialing") return { kind: "baru", opensAt: null };
  if (targetPriceMonthly > (current.priceMonthly ?? 0)) return { kind: "upgrade", opensAt: null };
  if (!current.periodEnd) return { kind: "perpanjang", opensAt: null };
  const opensAt = new Date(new Date(current.periodEnd).getTime() - RENEWAL_WINDOW_DAYS * DAY_MS);
  return { kind: "perpanjang", opensAt: now < opensAt ? opensAt : null };
}

/**
 * Awal periode baru setelah perpanjangan dibayar: lanjut dari akhir periode
 * lama selama masih tenggang, mulai saat bayar kalau sudah baca saja.
 */
export function renewalStart(periodEnd: Date, paidAt: Date): Date {
  return paidAt.getTime() < periodEnd.getTime() + PAYMENT_GRACE_DAYS * DAY_MS ? periodEnd : paidAt;
}
