/**
 * Daftar paket untuk halaman Paket dan pratinjau fitur terkunci. Datanya dari
 * tabel plans (lihat lib/billing/server.ts); file ini hanya menyusun.
 */

import { LEVEL_LABEL, type Level } from "@/lib/plans";

export type PlanRow = {
  code: string;
  tier: string;
  level: string;
  name: string;
  min_employees: number;
  max_employees: number | null;
  price_monthly: number | null;
  price_yearly: number | null;
  sort_order: number;
};

export type BillingCycle = "bulanan" | "tahunan";

export const TIER_LABEL: Record<string, string> = {
  benih: "Benih",
  tunas: "Tunas",
  tumbuh: "Tumbuh",
  berkembang: "Berkembang",
  rindang: "Rindang",
  hutan: "Hutan",
};

export function isBillingCycle(value: unknown): value is BillingCycle {
  return value === "bulanan" || value === "tahunan";
}

/** "2–5 karyawan", "51+ karyawan". */
export function rangeLabel(plan: Pick<PlanRow, "min_employees" | "max_employees">): string {
  return plan.max_employees === null
    ? `${plan.min_employees}+ karyawan`
    : `${plan.min_employees}–${plan.max_employees} karyawan`;
}

/** Harga per siklus. null = harga custom (Hutan). */
export function planPrice(plan: Pick<PlanRow, "price_monthly" | "price_yearly">, cycle: BillingCycle): number | null {
  return cycle === "tahunan" ? plan.price_yearly : plan.price_monthly;
}

/** Hemat bayar tahunan dibanding 12 x bulanan. 0 kalau tidak ada. */
export function yearlySaving(plan: Pick<PlanRow, "price_monthly" | "price_yearly">): number {
  if (plan.price_monthly === null || plan.price_yearly === null) return 0;
  return Math.max(plan.price_monthly * 12 - plan.price_yearly, 0);
}

/** Paket ini muat untuk jumlah karyawan sekarang (aktif + diundang). */
export function fitsEmployees(plan: Pick<PlanRow, "max_employees">, used: number): boolean {
  return plan.max_employees === null || plan.max_employees >= used;
}

/** Harga bulanan termurah yang membuka level ini. null = belum ada harga. */
export function startingPrice(plans: PlanRow[], level: Level): number | null {
  const prices = plans
    .filter((p) => p.level === level && p.price_monthly !== null && p.price_monthly > 0)
    .map((p) => p.price_monthly as number);
  return prices.length ? Math.min(...prices) : null;
}

export type TierGroup = {
  tier: string;
  label: string;
  range: string;
  /** false kalau karyawanmu sekarang melebihi batas tier ini. */
  fits: boolean;
  /** Harga custom: tidak bisa dibayar online. */
  custom: boolean;
  options: { level: Level; levelLabel: string; plan: PlanRow }[];
};

/** Paket berbayar dikelompokkan per tier, urut dari kecil ke besar. */
export function tierGroups(plans: PlanRow[], employeesUsed: number): TierGroup[] {
  const groups = new Map<string, TierGroup>();
  for (const plan of [...plans].sort((a, b) => a.sort_order - b.sort_order)) {
    if (plan.level !== "dasar" && plan.level !== "plus") continue;
    let group = groups.get(plan.tier);
    if (!group) {
      group = {
        tier: plan.tier,
        label: TIER_LABEL[plan.tier] ?? plan.tier,
        range: rangeLabel(plan),
        fits: fitsEmployees(plan, employeesUsed),
        custom: false,
        options: [],
      };
      groups.set(plan.tier, group);
    }
    if (plan.price_monthly === null) group.custom = true;
    group.options.push({ level: plan.level, levelLabel: LEVEL_LABEL[plan.level], plan });
  }
  return [...groups.values()];
}
