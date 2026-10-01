/** 1250000 → "Rp1.250.000". Uang selalu integer rupiah. */
export function formatRupiah(amount: number): string {
  return `Rp${Math.round(amount).toLocaleString("id-ID")}`;
}

/** Tanggal "30 Sep 2026" di zona waktu usaha. */
export function formatDate(value: string | Date, timeZone = "Asia/Jakarta"): string {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone,
  }).format(new Date(value));
}
