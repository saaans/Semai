/**
 * Helper fitur per paket. Datanya selalu dari tabel plans/plan_features
 * (lihat lib/plans-server.ts); file ini tanpa query supaya aman dipakai di
 * komponen client. Pengecekan resmi tetap has_feature() di database.
 */

export const LEVELS = ["benih", "dasar", "plus"] as const;
export type Level = (typeof LEVELS)[number];

export const FEATURE_KEYS = [
  "kasbon",
  "shift",
  "cuti",
  "multi_lokasi",
  "wa_auto",
  "export",
  "import_excel",
  "bpjs_pph21",
  "thr",
  "admin_tambahan",
  "slip_tanpa_watermark",
] as const;
export type FeatureKey = (typeof FEATURE_KEYS)[number];

export const LEVEL_LABEL: Record<Level, string> = {
  benih: "Benih",
  dasar: "Dasar",
  plus: "Plus",
};

export type CompanyPlan = {
  level: Level;
  /** Fitur aktif di level usaha ini. */
  features: FeatureKey[];
  /** Level termurah yang membuka tiap fitur (null = belum ada di paket mana pun). */
  minLevel: Partial<Record<FeatureKey, Level>>;
};

export function isLevel(value: unknown): value is Level {
  return typeof value === "string" && (LEVELS as readonly string[]).includes(value);
}

export function isFeatureKey(value: unknown): value is FeatureKey {
  return typeof value === "string" && (FEATURE_KEYS as readonly string[]).includes(value);
}

export function hasFeature(company: CompanyPlan, key: FeatureKey): boolean {
  return company.features.includes(key);
}

/** "Plus" untuk fitur yang baru terbuka di paket Plus. */
export function minLevelLabel(company: CompanyPlan, key: FeatureKey): string | null {
  const level = company.minLevel[key];
  return level ? LEVEL_LABEL[level] : null;
}
