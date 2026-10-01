import { z } from "zod";

/**
 * Normalisasi nomor HP Indonesia ke format 62xxxxxxxxxx.
 * Menerima 0812..., +62812..., 62812..., atau 812..., dengan spasi/strip.
 * Kembalikan null kalau bukan nomor HP Indonesia yang valid.
 */
export function normalizePhone(input: string): string | null {
  let digits = input.replace(/[\s\-().]/g, "");
  if (digits.startsWith("+")) digits = digits.slice(1);
  if (!/^\d+$/.test(digits)) return null;

  if (digits.startsWith("62")) digits = digits.slice(2);
  else if (digits.startsWith("0")) digits = digits.slice(1);

  // Nomor seluler Indonesia: diawali 8, total 9–13 digit setelah kode negara.
  if (!/^8\d{8,12}$/.test(digits)) return null;
  return `62${digits}`;
}

/** Tampilkan 628123456789 sebagai 0812-3456-789. */
export function formatPhone(normalized: string): string {
  const local = `0${normalized.replace(/^62/, "")}`;
  return local.replace(/^(\d{4})(\d{4})(\d+)$/, "$1-$2-$3");
}

const email = z
  .string()
  .trim()
  .min(1, { error: "Email wajib diisi." })
  .pipe(z.email({ error: "Format email belum benar. Contoh: nama@gmail.com." }))
  .transform((value) => value.toLowerCase());

const phone = z
  .string()
  .trim()
  .min(1, { error: "Nomor WA wajib diisi." })
  .transform((value, ctx) => {
    const normalized = normalizePhone(value);
    if (!normalized) {
      ctx.issues.push({
        code: "custom",
        input: value,
        message: "Nomor WA belum benar. Pakai nomor HP aktif, contoh: 0812 3456 7890.",
      });
      return z.NEVER;
    }
    return normalized;
  });

const newPassword = z
  .string()
  .min(8, { error: "Password minimal 8 karakter." })
  .max(72, { error: "Password maksimal 72 karakter." });

export const daftarSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, { error: "Nama wajib diisi, minimal 2 huruf." })
    .max(80, { error: "Nama terlalu panjang, maksimal 80 karakter." }),
  email,
  phone,
  password: newPassword,
});

export const masukSchema = z.object({
  email,
  password: z.string().min(1, { error: "Password wajib diisi." }),
});

export const emailSchema = z.object({ email });

export const phoneSchema = z.object({ phone });

export const passwordBaruSchema = z
  .object({
    password: newPassword,
    confirm: z.string(),
  })
  .refine((data) => data.password === data.confirm, {
    path: ["confirm"],
    error: "Konfirmasi password tidak sama. Ketik ulang password yang sama.",
  });

/** Ambil pesan error pertama per field dari hasil Zod. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    result[key] ??= issue.message;
  }
  return result;
}
