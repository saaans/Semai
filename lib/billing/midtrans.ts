import "server-only";

/**
 * Midtrans Snap (buat transaksi) dan Core API (cek status), lewat fetch.
 * Server key hanya dibaca di server dari MIDTRANS_SERVER_KEY.
 */

export type MidtransConfig = { serverKey: string; production: boolean };

/**
 * Konfigurasi Midtrans, atau null kalau MIDTRANS_SERVER_KEY belum diisi
 * (pembayaran online nonaktif). MIDTRANS_IS_PRODUCTION hanya "true" (huruf
 * apa pun) yang berarti produksi; selain itu sandbox.
 */
export function getMidtransConfig(): MidtransConfig | null {
  const serverKey = process.env.MIDTRANS_SERVER_KEY?.trim();
  if (!serverKey) {
    console.error("[midtrans] MIDTRANS_SERVER_KEY kosong di environment deployment ini.");
    return null;
  }
  return {
    serverKey,
    production: process.env.MIDTRANS_IS_PRODUCTION?.trim().toLowerCase() === "true",
  };
}

function authHeader(config: MidtransConfig) {
  return `Basic ${Buffer.from(`${config.serverKey}:`).toString("base64")}`;
}

/** VA bank dan QRIS saja. */
const ENABLED_PAYMENTS = ["bca_va", "bni_va", "bri_va", "echannel", "permata_va", "other_va", "other_qris"];

export type SnapRequest = {
  orderId: string;
  amount: number;
  itemName: string;
  itemId: string;
  customer: { name: string; email: string | null; phone: string | null };
  finishUrl: string;
};

/** Buat transaksi Snap. Mengembalikan link halaman bayar. */
export async function createSnapTransaction(config: MidtransConfig, request: SnapRequest): Promise<string> {
  const base = config.production ? "https://app.midtrans.com" : "https://app.sandbox.midtrans.com";
  const response = await fetch(`${base}/snap/v1/transactions`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: authHeader(config),
    },
    body: JSON.stringify({
      transaction_details: { order_id: request.orderId, gross_amount: request.amount },
      item_details: [
        { id: request.itemId, price: request.amount, quantity: 1, name: request.itemName.slice(0, 50) },
      ],
      customer_details: {
        first_name: request.customer.name.slice(0, 50),
        ...(request.customer.email ? { email: request.customer.email } : {}),
        ...(request.customer.phone ? { phone: request.customer.phone } : {}),
      },
      enabled_payments: ENABLED_PAYMENTS,
      expiry: { unit: "hours", duration: 24 },
      callbacks: { finish: request.finishUrl },
    }),
    cache: "no-store",
  });
  const body: unknown = await response.json().catch(() => null);
  const url =
    body && typeof body === "object" && "redirect_url" in body && typeof body.redirect_url === "string"
      ? body.redirect_url
      : null;
  if (!response.ok || !url) {
    console.error("[createSnapTransaction]", response.status, body);
    throw new Error("Midtrans menolak transaksi.");
  }
  return url;
}

export type MidtransStatus = Record<string, unknown>;

/** Status transaksi langsung dari Midtrans, untuk memastikan isi webhook. */
export async function getTransactionStatus(config: MidtransConfig, orderId: string): Promise<MidtransStatus | null> {
  const base = config.production ? "https://api.midtrans.com" : "https://api.sandbox.midtrans.com";
  const response = await fetch(`${base}/v2/${encodeURIComponent(orderId)}/status`, {
    headers: { Accept: "application/json", Authorization: authHeader(config) },
    cache: "no-store",
  });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok || !body || typeof body !== "object") {
    console.error("[getTransactionStatus]", response.status, body);
    return null;
  }
  return body as MidtransStatus;
}
