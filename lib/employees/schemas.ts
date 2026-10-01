import { z } from "zod";
import { normalizePhone } from "@/lib/auth/schemas";

const phone = z
  .string()
  .trim()
  .min(1, { error: "Nomor HP wajib diisi." })
  .transform((value, ctx) => {
    const normalized = normalizePhone(value);
    if (!normalized) {
      ctx.issues.push({
        code: "custom",
        input: value,
        message: "Nomor HP belum benar. Contoh: 0812 3456 7890.",
      });
      return z.NEVER;
    }
    return normalized;
  });

/** PIN yang terlalu mudah ditebak: semua angka sama atau berurutan. */
export function isWeakPin(pin: string): boolean {
  if (/^(\d)\1{5}$/.test(pin)) return true;
  return ["012345", "123456", "234567", "345678", "456789", "987654", "876543", "654321", "543210"].includes(pin);
}

const pin = z.string().regex(/^\d{6}$/, { error: "PIN harus 6 angka." });

export const tambahKaryawanSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, { error: "Nama wajib diisi, minimal 2 huruf." })
    .max(80, { error: "Nama terlalu panjang, maksimal 80 karakter." }),
  phone,
  position: z.string().trim().max(60, { error: "Jabatan maksimal 60 karakter." }),
  baseSalary: z
    .string()
    .trim()
    .transform((value) => value.replace(/[^\d]/g, ""))
    .pipe(
      z
        .string()
        .max(12, { error: "Gaji pokok terlalu besar. Cek lagi angkanya." })
        .transform((digits) => (digits === "" ? 0 : Number(digits))),
    ),
});

export const pinBaruSchema = z
  .object({ pin, confirm: z.string() })
  .refine((d) => !isWeakPin(d.pin), {
    path: ["pin"],
    error: "PIN terlalu mudah ditebak. Hindari angka sama atau berurutan seperti 123456.",
  })
  .refine((d) => d.pin === d.confirm, {
    path: ["confirm"],
    error: "PIN tidak sama. Ketik ulang PIN yang sama.",
  });

export const pinLamaSchema = z.object({ pin });

export const masukKaryawanSchema = z.object({ phone, pin });
