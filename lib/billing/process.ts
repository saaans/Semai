import "server-only";
import type { Json } from "@/lib/supabase/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTransactionStatus, type MidtransConfig } from "./midtrans";
import { parseGrossAmount, paymentOutcome } from "./payment";

export type ProcessResult = { result: string; retry: boolean };

/**
 * Ambil status transaksi langsung dari Midtrans lalu terapkan ke invoice
 * (apply_payment, idempoten). Dipakai webhook (setelah signature valid) dan
 * halaman Paket saat owner kembali dari halaman bayar. Semua hasil dicatat
 * di payment_events. retry = error sementara (webhook membalas 500).
 */
export async function processMidtransOrder(
  config: MidtransConfig,
  orderId: string,
  log: { payload: Json; signatureValid: boolean; source: "webhook" | "cek_status" },
): Promise<ProcessResult> {
  const admin = createAdminClient();

  async function record(result: string, transactionStatus: unknown) {
    const { error } = await admin.from("payment_events").insert({
      provider: "midtrans",
      order_id: orderId,
      transaction_status: typeof transactionStatus === "string" ? transactionStatus : null,
      signature_valid: log.signatureValid,
      payload: log.payload,
      result: log.source === "webhook" ? result : `${log.source}:${result}`,
    });
    if (error) console.error("[midtrans] simpan payment_events", error);
  }

  const status = await getTransactionStatus(config, orderId);
  if (!status) {
    await record("status_gagal", null);
    return { result: "status_gagal", retry: true };
  }
  // Belum ada transaksi (owner belum memilih metode bayar) atau notifikasi tes.
  if (status.status_code === "404" || status.order_id !== orderId) {
    await record("transaksi_tidak_ada", status.transaction_status);
    return { result: "transaksi_tidak_ada", retry: false };
  }

  const outcome = paymentOutcome(status.transaction_status, status.fraud_status);
  if (!outcome) {
    const result = `diabaikan:${String(status.transaction_status)}`;
    await record(result, status.transaction_status);
    return { result, retry: false };
  }

  const { data, error } = await admin.rpc("apply_payment", {
    p_order_id: orderId,
    p_outcome: outcome,
    p_gross_amount: parseGrossAmount(status.gross_amount),
    p_payment_method: typeof status.payment_type === "string" ? status.payment_type : null,
    p_transaction_id: typeof status.transaction_id === "string" ? status.transaction_id : null,
  });
  if (error) {
    console.error("[midtrans] apply_payment", error);
    await record("error_database", status.transaction_status);
    return { result: "error_database", retry: true };
  }

  const result = data ?? "ok";
  if (result === "nominal_beda") console.error("[midtrans] nominal tidak cocok", orderId, status.gross_amount);
  await record(result, status.transaction_status);
  return { result, retry: false };
}
