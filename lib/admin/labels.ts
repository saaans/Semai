/** Label status dan aksi untuk halaman super admin. */

export const SUBSCRIPTION_STATUS_LABEL: Record<string, string> = {
  trialing: "Trial",
  active: "Aktif",
  past_due: "Lewat jatuh tempo",
  canceled: "Dihentikan",
  expired: "Berakhir",
};

export const BILLING_STATE_LABEL: Record<string, string> = {
  normal: "Normal",
  tenggang: "Masa tenggang",
  baca_saja: "Baca saja",
};

export const INVOICE_STATUS_LABEL: Record<string, string> = {
  pending: "Menunggu bayar",
  paid: "Lunas",
  failed: "Gagal",
  expired: "Kedaluwarsa",
  void: "Dibatalkan",
};

export const INVOICE_KIND_LABEL: Record<string, string> = {
  baru: "Baru",
  upgrade: "Upgrade",
  perpanjang: "Perpanjang",
};

export const CYCLE_LABEL: Record<string, string> = {
  bulanan: "Bulanan",
  tahunan: "Tahunan",
};

export const PROVIDER_LABEL: Record<string, string> = {
  midtrans: "Midtrans",
  xendit: "Xendit",
  manual: "Manual (tim Semai)",
};

export const AUDIT_ACTION_LABEL: Record<string, string> = {
  "admin.set_plan": "Paket diubah tim Semai",
  "admin.extend_trial": "Trial diperpanjang",
  "admin.set_discount": "Diskon diubah",
  "admin.suspend": "Usaha ditangguhkan",
  "admin.unsuspend": "Usaha diaktifkan lagi",
  "subscription.trial_start": "Owner mulai trial",
  "subscription.downgrade_benih": "Owner turun ke Benih",
  "subscription.paid": "Pembayaran diterima",
  "subscription.plan_migrated": "Paket dipindah sistem",
  "invoice.create": "Tagihan dibuat",
};

/**
 * Hasil notifikasi Midtrans (payment_events.result) yang perlu dicek tim.
 * Hasil dari cek status owner diberi awalan "cek_status:".
 */
export const PAYMENT_EVENT_PROBLEMS: Record<string, string> = {
  signature_salah: "Tanda tangan notifikasi tidak valid",
  nominal_beda: "Nominal berbeda dengan tagihan",
  invoice_tidak_ada: "Nomor tagihan tidak dikenal",
  status_gagal: "Gagal mengambil status dari Midtrans",
  error_database: "Gagal menyimpan pembayaran",
};

export function paymentEventLabel(result: string | null): string {
  if (!result) return "–";
  const bare = result.replace(/^cek_status:/, "");
  return PAYMENT_EVENT_PROBLEMS[bare] ?? bare;
}

export function label(map: Record<string, string>, value: string | null | undefined): string {
  if (!value) return "–";
  return map[value] ?? value;
}
