/**
 * Pilihan dan isian awal onboarding. Fungsi murni, aman dipakai di server
 * maupun client. Harga dan fitur paket TIDAK di sini: dibaca dari tabel plans.
 */

export const TOTAL_STEPS = 6;

export const BUSINESS_TYPES = [
  { value: "kuliner", label: "Kuliner" },
  { value: "retail", label: "Retail/Toko" },
  { value: "salon", label: "Salon & Barbershop" },
  { value: "klinik", label: "Klinik" },
  { value: "bengkel", label: "Bengkel" },
  { value: "laundry", label: "Laundry" },
  { value: "jasa_lain", label: "Jasa lainnya" },
] as const;

export type BusinessType = (typeof BUSINESS_TYPES)[number]["value"];

export const TIMEZONES = [
  { value: "Asia/Jakarta", label: "WIB" },
  { value: "Asia/Makassar", label: "WITA" },
  { value: "Asia/Jayapura", label: "WIT" },
] as const;

export type Timezone = (typeof TIMEZONES)[number]["value"];

export const EMPLOYEE_RANGES = [
  { value: "1-5", label: "1–5", tier: "tunas" },
  { value: "6-15", label: "6–15", tier: "tumbuh" },
  { value: "16-30", label: "16–30", tier: "berkembang" },
  { value: "31-50", label: "31–50", tier: "rindang" },
  { value: "51+", label: "51+", tier: "hutan" },
] as const;

export type EmployeeRange = (typeof EMPLOYEE_RANGES)[number]["value"];

/** 1 = Senin ... 7 = Minggu (ISO), sama dengan work_schedules.work_days. */
export const WEEK_DAYS = [
  { value: 1, label: "Sen" },
  { value: 2, label: "Sel" },
  { value: 3, label: "Rab" },
  { value: 4, label: "Kam" },
  { value: 5, label: "Jum" },
  { value: 6, label: "Sab" },
  { value: 7, label: "Min" },
] as const;

export type WorkMode = "tetap" | "shift";

export type ScheduleDraft = { name: string; start: string; end: string };

export type ScheduleDefaults = {
  mode: WorkMode;
  schedules: ScheduleDraft[];
  workDays: number[];
  lateToleranceMin: number;
};

export const FIXED_SCHEDULE_NAME = "Jam kerja utama";
export const MAX_SHIFTS = 3;
export const DEFAULT_RADIUS_M = 100;

const STANDARD: ScheduleDraft = { name: FIXED_SCHEDULE_NAME, start: "08:00", end: "17:00" };

/** Isian awal langkah 3 sesuai bidang (PRD bagian 8). Semua bisa diubah owner. */
export function scheduleDefaultsFor(type: BusinessType | null): ScheduleDefaults {
  const base = { workDays: [1, 2, 3, 4, 5, 6], lateToleranceMin: 0 };
  switch (type) {
    case "kuliner":
      return {
        ...base,
        mode: "shift",
        schedules: [
          { name: "Pagi", start: "07:00", end: "15:00" },
          { name: "Sore", start: "15:00", end: "23:00" },
        ],
      };
    case "klinik":
      return {
        ...base,
        mode: "shift",
        schedules: [
          { name: "Pagi", start: "08:00", end: "14:00" },
          { name: "Sore", start: "14:00", end: "20:00" },
        ],
      };
    case "salon":
      return { ...base, mode: "shift", schedules: [{ ...STANDARD, name: "Shift 1" }] };
    case "retail":
      return { ...base, mode: "tetap", schedules: [STANDARD], lateToleranceMin: 10 };
    default:
      return { ...base, mode: "tetap", schedules: [STANDARD] };
  }
}

export type PlanRecommendation = {
  /** Kode di tabel plans, misalnya "tumbuh_plus". */
  code: string;
  level: "benih" | "dasar" | "plus";
  reason: string;
};

/**
 * Rekomendasi langkah 6 (satu harga per paket, semua fitur):
 * - 1–5 karyawan, jam tetap, 1 cabang → Benih
 * - selain itu → paket berbayar sesuai rentang ({tier}_plus)
 */
export function recommendPlan(input: {
  employeeRange: EmployeeRange;
  mode: WorkMode;
  branchCount: number;
}): PlanRecommendation {
  const tier = tierFor(input.employeeRange);
  const needsPaid = input.mode === "shift" || input.branchCount > 1;

  if (needsPaid) {
    return {
      code: `${tier}_plus`,
      level: "plus",
      reason:
        input.mode === "shift"
          ? "Usahamu pakai shift. Jadwal shift dan tukar shift ada di paket berbayar."
          : "Usahamu punya lebih dari satu cabang. Banyak lokasi absen ada di paket berbayar.",
    };
  }
  if (input.employeeRange === "1-5") {
    return {
      code: "benih",
      level: "benih",
      reason: "Untuk 1–5 karyawan dengan jam tetap, paket gratis sudah cukup.",
    };
  }
  return {
    code: `${tier}_plus`,
    level: "plus",
    reason: "Gaji, slip, kasbon, dan semua fitur lain sesuai jumlah karyawanmu.",
  };
}

/** Paket berbayar yang dipakai untuk trial 14 hari, sesuai rentang karyawan. */
export function trialPlanCode(range: EmployeeRange): string {
  return `${tierFor(range)}_plus`;
}

function tierFor(range: EmployeeRange): string {
  return EMPLOYEE_RANGES.find((r) => r.value === range)?.tier ?? "tunas";
}
