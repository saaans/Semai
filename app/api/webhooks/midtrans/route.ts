import { NextResponse, type NextRequest } from "next/server";
import { getMidtransConfig } from "@/lib/billing/midtrans";
import { isValidSignature, type MidtransNotification } from "@/lib/billing/payment";
import { processMidtransOrder } from "@/lib/billing/process";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/types";

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
  console.info("[midtrans webhook] notifikasi masuk");
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
    console.error("[midtrans webhook] isi bukan JSON");
    return NextResponse.json({ error: "Isi notifikasi tidak valid." }, { status: 400 });
  }

  const orderId = typeof body.order_id === "string" ? body.order_id : null;
  if (!orderId || !isValidSignature(body, config.serverKey)) {
    console.error("[midtrans webhook] signature tidak valid", orderId);
    const { error } = await createAdminClient().from("payment_events").insert({
      provider: "midtrans",
      order_id: orderId,
      transaction_status: typeof body.transaction_status === "string" ? body.transaction_status : null,
      signature_valid: false,
      payload: body as Json,
      result: "signature_salah",
    });
    if (error) console.error("[midtrans webhook] simpan payment_events", error);
    return NextResponse.json({ error: "Signature tidak valid." }, { status: 401 });
  }

  const { result, retry } = await processMidtransOrder(config, orderId, {
    payload: body as Json,
    signatureValid: true,
    source: "webhook",
  });
  console.info("[midtrans webhook]", orderId, result);
  if (retry) return NextResponse.json({ error: "Gagal memproses, coba kirim ulang.", result }, { status: 500 });
  return NextResponse.json({ ok: true, result });
}
