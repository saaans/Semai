/**
 * Validasi form aksi super admin. Database tetap memeriksa ulang semuanya
 * (admin_* RPC); ini supaya pesan error muncul di field yang tepat.
 */

import { z } from "zod";

const reason = z
  .string({ error: "Tulis alasan perubahan." })
  .trim()
  .min(5, "Tulis alasan minimal 5 huruf. Alasan disimpan di catatan audit.")
  .max(300, "Alasan maksimal 300 huruf.");

const companyId = z.uuid({ error: "Usaha tidak dikenal. Muat ulang halaman." });

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pilih tanggal.");

/**
 * Tanggal dari input date ("2026-10-31") jadi akhir hari itu di WIB, supaya
 * paket/diskon berlaku sampai hari tersebut selesai.
 */
export function endOfDayWib(date: string): string {
  return new Date(`${date}T23:59:59+07:00`).toISOString();
}

/** "Rp1.250.000", "1250000", "1.250.000" → 1250000. Kosong → null, bukan angka → NaN. */
export function parseRupiahInput(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const digits = value.replace(/^\s*rp\s*/i, "").replace(/[.\s]/g, "");
  if (digits === "") return null;
  if (!/^\d+$/.test(digits)) return NaN;
  return Number(digits);
}

export const setPlanSchema = z
  .object({
    companyId,
    planCode: z.string().regex(/^[a-z0-9_]{1,40}$/, "Pilih paket."),
    cycle: z.enum(["bulanan", "tahunan"], { error: "Pilih siklus bulanan atau tahunan." }),
    periodEnd: isoDate.optional(),
    price: z
      .number({ error: "Harga hanya boleh angka, contoh 450000." })
      .int()
      .min(0, "Harga tidak boleh minus.")
      .max(1_000_000_000, "Harga terlalu besar.")
      .nullable(),
    reason,
  })
  .superRefine((value, ctx) => {
    if (value.planCode !== "benih" && !value.periodEnd) {
      ctx.addIssue({ code: "custom", path: ["periodEnd"], message: "Pilih tanggal akhir periode." });
    }
  });

export const extendTrialSchema = z.object({
  companyId,
  days: z.coerce
    .number({ error: "Isi jumlah hari." })
    .int("Jumlah hari harus bilangan bulat.")
    .min(1, "Minimal 1 hari.")
    .max(30, "Maksimal 30 hari sekali perpanjang."),
  reason,
});

export const setDiscountSchema = z.object({
  companyId,
  percent: z.coerce
    .number({ error: "Isi persen diskon." })
    .int("Persen diskon harus bilangan bulat.")
    .min(1, "Diskon minimal 1%.")
    .max(100, "Diskon maksimal 100%."),
  until: isoDate.nullable(),
  reason,
});

export const removeDiscountSchema = z.object({ companyId, reason });

export const setSuspendedSchema = z.object({
  companyId,
  suspended: z.enum(["1", "0"]).transform((v) => v === "1"),
  reason,
});

/** Pesan error pertama per field, untuk ditampilkan di bawah input. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
