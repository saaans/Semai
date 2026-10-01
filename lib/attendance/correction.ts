import { z } from "zod";

/** Status yang bisa dipilih owner saat koreksi absen. */
export const CORRECTION_STATUSES = [
  { value: "hadir", label: "Hadir" },
  { value: "izin", label: "Izin" },
  { value: "sakit", label: "Sakit" },
  { value: "alpa", label: "Tidak masuk" },
  { value: "libur", label: "Libur" },
] as const;

const clock = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, { error: "Isi jam dengan format 08:00." });

/** Validasi form koreksi. Aturan resmi tetap di RPC correct_attendance. */
export const koreksiSchema = z
  .object({
    employeeId: z.uuid({ error: "Karyawan tidak dikenal. Muat ulang halaman lalu coba lagi." }),
    workDate: z.iso.date({ error: "Tanggal tidak valid. Muat ulang halaman lalu coba lagi." }),
    status: z.enum(["hadir", "izin", "sakit", "alpa", "libur"], {
      error: "Pilih status: hadir, izin, sakit, tidak masuk, atau libur.",
    }),
    clockIn: z.union([clock, z.literal("")]),
    clockOut: z.union([clock, z.literal("")]),
    reason: z
      .string()
      .trim()
      .min(5, { error: 'Tulis alasan koreksi minimal 5 huruf, misalnya "HP karyawan rusak".' })
      .max(300, { error: "Alasan koreksi terlalu panjang. Maksimal 300 huruf." }),
  })
  .superRefine((value, ctx) => {
    if (value.status === "hadir" && !value.clockIn) {
      ctx.addIssue({ code: "custom", path: ["clockIn"], message: "Isi jam masuk untuk status hadir." });
    }
  });

export type KoreksiInput = z.infer<typeof koreksiSchema>;
