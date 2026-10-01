import { z } from "zod";
import { phoneSchema } from "@/lib/auth/schemas";
import {
  BUSINESS_TYPES,
  EMPLOYEE_RANGES,
  MAX_SHIFTS,
  TIMEZONES,
  type BusinessType,
  type EmployeeRange,
  type Timezone,
} from "./defaults";

const values = <T extends string>(list: readonly { value: T }[]) =>
  list.map((item) => item.value) as [T, ...T[]];

export const profilUsahaSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, { error: "Nama usaha wajib diisi, minimal 2 huruf." })
      .max(80, { error: "Nama usaha terlalu panjang, maksimal 80 karakter." }),
    businessType: z.enum(values<BusinessType>(BUSINESS_TYPES), {
      error: "Pilih bidang usaha yang paling mendekati.",
    }),
    city: z
      .string()
      .trim()
      .min(2, { error: "Kota wajib diisi. Contoh: Bandung." })
      .max(60, { error: "Nama kota terlalu panjang, maksimal 60 karakter." }),
    timezone: z.enum(values<Timezone>(TIMEZONES), {
      error: "Pilih zona waktu usaha: WIB, WITA, atau WIT.",
    }),
  })
  .extend(phoneSchema.shape);

export const ukuranUsahaSchema = z.object({
  employeeRange: z.enum(values<EmployeeRange>(EMPLOYEE_RANGES), {
    error: "Pilih perkiraan jumlah karyawan.",
  }),
  branchCount: z.coerce
    .number({ error: "Jumlah cabang harus berupa angka." })
    .int({ error: "Jumlah cabang harus bilangan bulat." })
    .min(1, { error: "Minimal 1 cabang." })
    .max(50, { error: "Maksimal 50 cabang. Untuk lebih dari itu, hubungi kami." }),
});

/** Input kosong jadi undefined, supaya "" tidak dibaca sebagai 0. */
const emptyToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

const time = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, { error: "Format jam belum benar. Contoh: 08:00." });

export const jamKerjaSchema = z
  .object({
    mode: z.enum(["tetap", "shift"], { error: "Pilih jam tetap atau shift." }),
    schedules: z
      .array(
        z
          .object({
            name: z
              .string()
              .trim()
              .min(1, { error: "Nama shift wajib diisi. Contoh: Pagi." })
              .max(40, { error: "Nama shift maksimal 40 karakter." }),
            start: time,
            end: time,
          })
          .refine((s) => s.start !== s.end, {
            error: "Jam masuk dan jam pulang tidak boleh sama.",
          }),
      )
      .min(1, { error: "Isi minimal satu jam kerja." })
      .max(MAX_SHIFTS, { error: `Maksimal ${MAX_SHIFTS} shift saat onboarding.` }),
    workDays: z
      .array(z.coerce.number().int().min(1).max(7))
      .min(1, { error: "Pilih minimal satu hari kerja." }),
    lateToleranceMin: z.coerce
      .number({ error: "Toleransi telat harus berupa angka menit." })
      .int({ error: "Toleransi telat harus bilangan bulat." })
      .min(0, { error: "Toleransi telat tidak boleh minus." })
      .max(240, { error: "Toleransi telat maksimal 240 menit." }),
  })
  .refine((d) => d.mode === "shift" || d.schedules.length === 1, {
    path: ["schedules"],
    error: "Jam tetap hanya punya satu jam masuk dan pulang.",
  })
  .refine((d) => new Set(d.schedules.map((s) => s.name.toLowerCase())).size === d.schedules.length, {
    path: ["schedules"],
    error: "Nama shift tidak boleh sama. Beri nama berbeda, misalnya Pagi dan Sore.",
  });

const coordinate = (min: number, max: number) =>
  z.preprocess(
    emptyToUndefined,
    z.coerce
      .number({ error: "Pilih titik lokasi di peta dulu, atau ketuk Pakai lokasi saya." })
      .min(min, { error: "Titik lokasi di luar peta. Pilih ulang titiknya." })
      .max(max, { error: "Titik lokasi di luar peta. Pilih ulang titiknya." }),
  );

export const lokasiSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { error: "Nama lokasi wajib diisi. Contoh: Toko pusat." })
    .max(80, { error: "Nama lokasi maksimal 80 karakter." }),
  latitude: coordinate(-90, 90),
  longitude: coordinate(-180, 180),
  radiusM: z.coerce
    .number({ error: "Radius harus berupa angka meter." })
    .int()
    .min(10, { error: "Radius minimal 10 m." })
    .max(1000, { error: "Radius maksimal 1.000 m." }),
});

export const paketSchema = z.object({
  choice: z.enum(["trial_plus", "berbayar", "benih"], { error: "Pilih salah satu paket." }),
  planCode: z.string().trim().max(40).optional(),
});
