import { z } from "zod";

/** Batas unggahan per absen (PRD: < 100 KB). Target kompres ±50 KB. */
export const MAX_PHOTO_BYTES = 100 * 1024;
export const PHOTO_TYPES = ["image/jpeg", "image/webp"] as const;

export const absenSchema = z.object({
  action: z.enum(["masuk", "pulang"], { error: "Jenis absen tidak dikenal." }),
  companyId: z.uuid({ error: "Usaha tidak dikenal. Muat ulang aplikasi lalu coba lagi." }),
  requestId: z.uuid({ error: "Permintaan absen tidak lengkap. Muat ulang aplikasi lalu coba lagi." }),
  lat: z.coerce
    .number({ error: "Lokasi HP tidak terbaca. Nyalakan GPS lalu coba lagi." })
    .min(-90)
    .max(90),
  lng: z.coerce
    .number({ error: "Lokasi HP tidak terbaca. Nyalakan GPS lalu coba lagi." })
    .min(-180)
    .max(180),
  accuracy: z.coerce.number().min(0).max(100000).transform(Math.round),
  offline: z.enum(["true", "false"]).transform((v) => v === "true"),
  deviceCapturedAt: z.iso.datetime({ offset: true }).optional(),
});

export type AbsenInput = z.infer<typeof absenSchema>;

/** Jawaban /api/absen. retry = boleh dikirim ulang dari antrean offline. */
export type AbsenResponse =
  | { ok: true; action: "masuk" | "pulang"; at: string; lateMinutes: number }
  | { ok: false; retry: boolean; message: string; sessionExpired?: boolean };
