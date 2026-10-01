import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { isFeatureKey, isLevel, LEVELS, type CompanyPlan, type FeatureKey, type Level } from "./plans";

/** Level usaha + fitur aktif, dibaca dari plan_features. Sekali per request. */
export const getCompanyPlan = cache(async (companyId: string): Promise<CompanyPlan> => {
  const supabase = await createClient();
  const [{ data: level, error: levelError }, { data: rows, error }, { data: plans, error: plansError }] =
    await Promise.all([
      supabase.rpc("company_level", { p_company_id: companyId }),
      supabase.from("plan_features").select("level, feature_key, enabled").eq("enabled", true),
      supabase.from("plans").select("level").eq("is_active", true),
    ]);
  if (levelError || error || plansError) {
    console.error("[getCompanyPlan]", levelError ?? error ?? plansError);
    throw new Error("Gagal memuat paket usaha. Coba muat ulang halaman.");
  }
  // Paket minimum hanya dari level yang masih dijual (level dasar tidak lagi).
  const soldLevels = new Set(plans.map((p) => p.level));

  const current: Level = isLevel(level) ? level : "benih";
  const features: FeatureKey[] = [];
  const minLevel: Partial<Record<FeatureKey, Level>> = {};

  for (const row of rows) {
    if (!isFeatureKey(row.feature_key) || !isLevel(row.level)) continue;
    if (row.level === current) features.push(row.feature_key);
    if (!soldLevels.has(row.level)) continue;
    const known = minLevel[row.feature_key];
    if (!known || LEVELS.indexOf(row.level) < LEVELS.indexOf(known)) {
      minLevel[row.feature_key] = row.level;
    }
  }

  return { level: current, features, minLevel };
});
