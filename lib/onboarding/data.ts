import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { TOTAL_STEPS, type WorkMode } from "./defaults";

/** Isi companies.onboarding yang dipakai app. Kolomnya jsonb bebas. */
export type OnboardingProgress = {
  /** Langkah terakhir yang sudah disimpan (0 = belum ada). */
  step: number;
  mode?: WorkMode;
  plan_choice?: string;
  plan_code?: string;
};

export function parseProgress(value: unknown): OnboardingProgress {
  const raw = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const step = typeof raw.step === "number" ? Math.min(Math.max(raw.step, 0), TOTAL_STEPS) : 0;
  return {
    ...raw,
    step,
    mode: raw.mode === "shift" || raw.mode === "tetap" ? raw.mode : undefined,
    plan_choice: typeof raw.plan_choice === "string" ? raw.plan_choice : undefined,
    plan_code: typeof raw.plan_code === "string" ? raw.plan_code : undefined,
  };
}

/** Langkah paling jauh yang boleh dibuka: satu setelah yang terakhir disimpan. */
export function furthestStep(progress: OnboardingProgress): number {
  return Math.min(progress.step + 1, TOTAL_STEPS);
}

/** Data usaha + jam kerja + lokasi untuk form onboarding. */
export const getOnboardingData = cache(async (companyId: string) => {
  const supabase = await createClient();

  const [company, schedules, location] = await Promise.all([
    supabase
      .from("companies")
      .select("name, business_type, city, timezone, employee_range, branch_count, onboarding")
      .eq("id", companyId)
      .single(),
    supabase
      .from("work_schedules")
      .select("id, name, start_time, end_time, work_days, late_tolerance_min, is_default")
      .eq("company_id", companyId)
      .order("is_default", { ascending: false })
      .order("created_at"),
    supabase
      .from("locations")
      .select("id, name, latitude, longitude, radius_m")
      .eq("company_id", companyId)
      .order("created_at")
      .limit(1)
      .maybeSingle(),
  ]);

  if (company.error || schedules.error || location.error) {
    throw new Error("Gagal memuat data onboarding. Coba muat ulang halaman.");
  }

  return {
    company: company.data,
    progress: parseProgress(company.data.onboarding),
    schedules: schedules.data,
    location: location.data,
  };
});

export type OnboardingData = Awaited<ReturnType<typeof getOnboardingData>>;
