import { z } from "zod";

/** Nilai harus sama dengan check constraint di tabel feedbacks. */
export const FEEDBACK_CATEGORIES = [
  { value: "saran_fitur", label: "Saran fitur" },
  { value: "bug", label: "Laporan bug" },
  { value: "pertanyaan", label: "Pertanyaan" },
  { value: "lainnya", label: "Lainnya" },
] as const;

export const FEEDBACK_STATUSES = [
  { value: "baru", label: "Baru" },
  { value: "ditinjau", label: "Ditinjau" },
  { value: "direncanakan", label: "Direncanakan" },
  { value: "selesai", label: "Selesai" },
  { value: "ditolak", label: "Ditolak" },
] as const;

/** "" = belum diset (null di database). */
export const FEEDBACK_PRIORITIES = [
  { value: "", label: "Belum diset" },
  { value: "rendah", label: "Rendah" },
  { value: "sedang", label: "Sedang" },
  { value: "tinggi", label: "Tinggi" },
] as const;

type Option = { readonly value: string; readonly label: string };
function values<T extends readonly Option[]>(options: T) {
  return options.map((o) => o.value) as unknown as [T[number]["value"], ...T[number]["value"][]];
}

export function feedbackLabel(options: readonly Option[], value: string | null): string {
  return options.find((o) => o.value === (value ?? ""))?.label ?? value ?? "";
}

export const feedbackSchema = z.object({
  category: z.enum(values(FEEDBACK_CATEGORIES), { error: "Pilih kategori masukan." }),
  message: z
    .string()
    .trim()
    .min(5, { error: "Ceritakan sedikit lebih detail, minimal 5 karakter." })
    .max(2000, { error: "Masukan terlalu panjang, maksimal 2.000 karakter." }),
  pagePath: z
    .string()
    .trim()
    .transform((value) => (value.startsWith("/") && !value.startsWith("//") ? value.slice(0, 200) : null)),
});

export const feedbackStatusSchema = z.object({
  id: z.uuid({ error: "Masukan tidak ditemukan." }),
  status: z.enum(values(FEEDBACK_STATUSES), { error: "Status tidak dikenal." }),
  priority: z
    .enum(values(FEEDBACK_PRIORITIES), { error: "Prioritas tidak dikenal." })
    .transform((value) => (value === "" ? null : value)),
});
