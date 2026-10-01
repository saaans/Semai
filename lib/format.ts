/** 1250000 → "Rp1.250.000". Uang selalu integer rupiah. */
export function formatRupiah(amount: number): string {
  return `Rp${Math.round(amount).toLocaleString("id-ID")}`;
}
