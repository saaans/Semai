import { NextResponse, type NextRequest } from "next/server";
import { getMidtransConfig, getTransactionStatus } from "@/lib/billing/midtrans";
import { isValidSignature, parseGrossAmount, paymentOutcome, type MidtransNotification } from "@/lib/billing/payment";
import type { Json } from "@/lib/supabase/types";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Notifikasi pembayaran Midtrans (Payment Notification URL).
 * 1. Cek signature dengan server key. Salah = 401.
 * 2. Ambil ulang status dari API Midtrans (isi webhook tidak dipercaya mentah).
 * 3. apply_payment() di database: idempoten, nominal dicocokkan dengan invoice.
 * Semua notifikasi dicatat di payment_events. Error sementara = 500 supaya
 * Midtrans mengirim ulang.
 */
export async function POST(request: NextRequest) {
  const config = getMidtransConfig();
  if (!config) {
    return NextResponse.json({ error: "Pembayaran online belum diatur." }, { status: 503 });
  }

  let body: MidtransNotification & Record<string, unknown>;
  try {
    const parsed: unknown = await request.json();
    if (!parsed || typeof parsed !== "object") throw new Error("bukan objek");
    body = parsed as MidtransNotification & Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Isi notifikasi tidak valid." }, { status: 400 });
  }

  const admin = createAdminClient();
  const orderId = typeof body.order_id === "string" ? body.order_id : null;
  const signatureValid = isValidSignature(body, config.serverKey);

  async function record(result: string, transactionStatus: unknown = body.transaction_status) {
    const { error } = await admin.from("payment_events").insert({
      provider: "midtrans",
      order_id: orderId,
      transaction_status: typeof transactionStatus === "string" ? transactionStatus : null,
      signature_valid: signatureValid,
      payload: body as Json,
      result,
    });
    if (error) console.error("[midtrans webhook] simpan event", error);
  }

  if (!signatureValid || !orderId) {
    await record("signature_salah");
    return NextResponse.json({ error: "Signature tidak valid." }, { status: 401 });
  }

  const status = await getTransactionStatus(config, orderId);
  if (!status) {
    await record("status_gagal");
    return NextResponse.json({ error: "Gagal cek status ke Midtrans." }, { status: 500 });
  }
  // Notifikasi tes dari dashboard Midtrans memakai order_id yang tidak ada.
  if (status.status_code === "404" || status.order_id !== orderId) {
    await record("transaksi_tidak_ada", status.transaction_status);
    return NextResponse.json({ ok: true, result: "transaksi_tidak_ada" });
  }

  const outcome = paymentOutcome(status.transaction_status, status.fraud_status);
  if (!outcome) {
    await record(`diabaikan:${String(status.transaction_status)}`, status.transaction_status);
    return NextResponse.json({ ok: true, result: "diabaikan" });
  }

  const { data: result, error } = await admin.rpc("apply_payment", {
    p_order_id: orderId,
    p_outcome: outcome,
    p_gross_amount: parseGrossAmount(status.gross_amount),
    p_payment_method: typeof status.payment_type === "string" ? status.payment_type : null,
    p_transaction_id: typeof status.transaction_id === "string" ? status.transaction_id : null,
  });
  if (error) {
    console.error("[midtrans webhook] apply_payment", error);
    await record("error_database", status.transaction_status);
    return NextResponse.json({ error: "Gagal memproses pembayaran." }, { status: 500 });
  }

  await record(result ?? "ok", status.transaction_status);
  if (result === "nominal_beda") console.error("[midtrans webhook] nominal tidak cocok", orderId, status.gross_amount);
  return NextResponse.json({ ok: true, result });
}
