import { describe, expect, it } from "vitest";
import { paidPlans, planPrice, rangeLabel, startingPrice, yearlySaving, type PlanRow } from "./catalog";
import { addDays, billingStateAt, daysLeft, quotaStatus, shouldWarnQuota } from "./state";

// Sama dengan tabel plans setelah satu harga per paket (dasar tidak dijual).
const PLANS: PlanRow[] = [
  ["benih", "benih", "benih", "Benih", 1, 5, 0, 0, 10],
  ["tunas_plus", "tunas", "plus", "Tunas", 2, 5, 39000, 390000, 21],
  ["tumbuh_plus", "tumbuh", "plus", "Tumbuh", 6, 15, 69000, 690000, 31],
  ["hutan_plus", "hutan", "plus", "Hutan", 51, null, null, null, 61],
].map(([code, tier, level, name, min, max, monthly, yearly, sort]) => ({
  code: code as string,
  tier: tier as string,
  level: level as string,
  name: name as string,
  min_employees: min as number,
  max_employees: max as number | null,
  price_monthly: monthly as number | null,
  price_yearly: yearly as number | null,
  sort_order: sort as number,
}));

function plan(code: string): PlanRow {
  const found = PLANS.find((p) => p.code === code);
  if (!found) throw new Error(code);
  return found;
}

const NOW = new Date("2026-10-15T05:00:00Z");

describe("billingStateAt", () => {
  it("normal tanpa langganan, saat trial, dan selama periode berjalan", () => {
    expect(billingStateAt(null, NOW)).toBe("normal");
    expect(billingStateAt({ status: "trialing", currentPeriodEnd: "2026-10-01T00:00:00Z" }, NOW)).toBe("normal");
    expect(billingStateAt({ status: "active", currentPeriodEnd: "2026-10-16T00:00:00Z" }, NOW)).toBe("normal");
  });

  it("tenggang 7 hari setelah periode lewat, lalu baca saja", () => {
    expect(billingStateAt({ status: "active", currentPeriodEnd: "2026-10-15T04:00:00Z" }, NOW)).toBe("tenggang");
    expect(billingStateAt({ status: "past_due", currentPeriodEnd: "2026-10-08T05:00:01Z" }, NOW)).toBe("tenggang");
    expect(billingStateAt({ status: "past_due", currentPeriodEnd: "2026-10-08T05:00:00Z" }, NOW)).toBe("baca_saja");
  });
});

describe("daysLeft", () => {
  it("dibulatkan ke atas dan tidak negatif", () => {
    expect(daysLeft(addDays(NOW, 14), NOW)).toBe(14);
    expect(daysLeft(new Date(NOW.getTime() + 60_000), NOW)).toBe(1);
    expect(daysLeft("2026-10-01T00:00:00Z", NOW)).toBe(0);
  });
});

describe("quotaStatus", () => {
  it("menulis teks kuota", () => {
    expect(quotaStatus(4, 5)?.text).toBe("4 dari 5 karyawan terpakai");
  });

  it("memberi peringatan mulai sisa satu kursi", () => {
    expect(quotaStatus(3, 5)?.tone).toBe("aman");
    expect(quotaStatus(4, 5)?.tone).toBe("hampir");
    expect(quotaStatus(5, 5)?.tone).toBe("penuh");
    expect(quotaStatus(7, 5)).toMatchObject({ tone: "lewat", remaining: 0 });
    expect(shouldWarnQuota(quotaStatus(3, 5))).toBe(false);
    expect(shouldWarnQuota(quotaStatus(4, 5))).toBe(true);
  });

  it("tanpa batas tidak ada kuota", () => {
    expect(quotaStatus(80, null)).toBeNull();
    expect(shouldWarnQuota(quotaStatus(80, null))).toBe(false);
  });
});

describe("katalog paket", () => {
  it("label rentang dan harga per siklus", () => {
    expect(rangeLabel(plan("tunas_plus"))).toBe("2–5 karyawan");
    expect(rangeLabel(plan("hutan_plus"))).toBe("51+ karyawan");
    expect(planPrice(plan("tunas_plus"), "bulanan")).toBe(39000);
    expect(planPrice(plan("tunas_plus"), "tahunan")).toBe(390000);
    expect(planPrice(plan("hutan_plus"), "tahunan")).toBeNull();
  });

  it("tahunan hemat 2 bulan", () => {
    expect(yearlySaving(plan("tunas_plus"))).toBe(78000);
    expect(yearlySaving(plan("hutan_plus"))).toBe(0);
  });

  it("harga mulai dari, tanpa Benih dan harga custom", () => {
    expect(startingPrice(PLANS, "plus")).toBe(39000);
    expect(startingPrice(PLANS, "benih")).toBeNull();
  });

  it("satu baris per paket berbayar, menandai yang tidak muat", () => {
    const list = paidPlans(PLANS, 7);
    expect(list.map((p) => p.plan.code)).toEqual(["tunas_plus", "tumbuh_plus", "hutan_plus"]);
    expect(list[0]).toMatchObject({ label: "Tunas", fits: false, custom: false });
    expect(list[1]).toMatchObject({ label: "Tumbuh", fits: true, range: "6–15 karyawan" });
    expect(list[2]).toMatchObject({ label: "Hutan", fits: true, custom: true });
  });
});
