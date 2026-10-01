import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { isFeatureKey, isLevel, LEVELS, type CompanyPlan, type FeatureKey, type Level } from "./plans";

/** Level usaha + fitur aktif, dibaca dari plan_features. Sekali per request. */
export const getCompanyPlan = cache(async (companyId: string): Promise<CompanyPlan> => {
  const supabase = await createClient();
  const [{ data: level, error: levelError }, { data: rows, error }] = await Promise.all([
    supabase.rpc("company_level", { p_company_id: companyId }),
    supabase.from("plan_features").select("level, feature_key, enabled").eq("enabled", true),
  ]);
  if (levelError || error) {
    console.error("[getCompanyPlan]", levelError ?? error);
    throw new Error("Gagal memuat paket usaha. Coba muat ulang halaman.");
  }

  const current: Level = isLevel(level) ? level : "benih";
  const features: FeatureKey[] = [];
  const minLevel: Partial<Record<FeatureKey, Level>> = {};

  for (const row of rows) {
    if (!isFeatureKey(row.feature_key) || !isLevel(row.level)) continue;
    if (row.level === current) features.push(row.feature_key);
    const known = minLevel[row.feature_key];
    if (!known || LEVELS.indexOf(row.level) < LEVELS.indexOf(known)) {
      minLevel[row.feature_key] = row.level;
    }
  }

  return { level: current, features, minLevel };
});
