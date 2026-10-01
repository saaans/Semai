import { describe, expect, it } from "vitest";
import { companyFiltersQuery, hasActiveFilter, parseCompanyFilters } from "./filters";
import { formatPercent, parseMetrics, ratio } from "./metrics";
import { endOfDayWib, extendTrialSchema, parseRupiahInput, setPlanSchema } from "./schemas";

describe("filter daftar usaha", () => {
  it("membaca query string yang valid", () => {
    const f = parseCompanyFilters({ q: " kopi ", bidang: "kuliner", kota: "Bandung", paket: "tumbuh_plus", aktif: "7_hari", hal: "2" });
    expect(f).toEqual({ search: "kopi", businessType: "kuliner", city: "Bandung", plan: "tumbuh_plus", activity: "7_hari", page: 2 });
  });

  it("mengabaikan nilai yang tidak dikenal", () => {
    const f = parseCompanyFilters({ bidang: "kapal", paket: "DROP TABLE", aktif: "kemarin", hal: "-3", q: "" });
    expect(f).toEqual({ search: null, businessType: null, city: null, plan: null, activity: null, page: 1 });
    expect(hasActiveFilter(f)).toBe(false);
  });

  it("memakai nilai pertama kalau parameter berulang", () => {
    expect(parseCompanyFilters({ paket: ["trial", "benih"] }).plan).toBe("trial");
  });

  it("menyusun query string tanpa nilai kosong", () => {
    expect(companyFiltersQuery({ search: "kopi", plan: "trial", page: 1 })).toBe("?q=kopi&paket=trial");
    expect(companyFiltersQuery({ city: "Bandung", page: 3 })).toBe("?kota=Bandung&hal=3");
    expect(companyFiltersQuery({})).toBe("");
  });
});

describe("metrik dashboard", () => {
  const raw = {
    registered: 40,
    new_30d: 6,
    active_7d: 30,
    paying: 10,
    trialing: 4,
    mrr: 690000,
    mrr_custom_unpriced: 0,
    churn_base: 8,
    churned: 1,
    ever_paid: 12,
    trial_done: 20,
    trial_paid: 9,
    per_plan: [{ plan_code: "benih", name: "Benih", tier: "benih", companies: 26, trialing: 0 }],
  };

  it("menghitung persentase", () => {
    const m = parseMetrics(raw);
    expect(m.activeRate).toBe(0.75);
    expect(m.churnRate).toBe(0.125);
    expect(m.conversionRate).toBe(0.3);
    expect(m.trialConversionRate).toBe(0.45);
  });

  it("null kalau pembagi nol", () => {
    const m = parseMetrics({ ...raw, registered: 0, churn_base: 0, trial_done: 0 });
    expect(m.activeRate).toBeNull();
    expect(m.churnRate).toBeNull();
    expect(m.trialConversionRate).toBeNull();
    expect(ratio(1, 0)).toBeNull();
  });

  it("menolak bentuk data yang salah", () => {
    expect(() => parseMetrics({ ...raw, mrr: "banyak" })).toThrow();
  });

  it("format persen", () => {
    expect(formatPercent(0.125)).toBe("13%");
    expect(formatPercent(0.045)).toBe("4,5%");
    expect(formatPercent(0)).toBe("0%");
    expect(formatPercent(null)).toBe("–");
  });
});

describe("form aksi super admin", () => {
  const id = "10000000-0000-4000-8000-00000000000a";

  it("akhir hari WIB", () => {
    expect(endOfDayWib("2026-10-31")).toBe("2026-10-31T16:59:59.000Z");
  });

  it("membaca nominal rupiah", () => {
    expect(parseRupiahInput("Rp1.250.000")).toBe(1250000);
    expect(parseRupiahInput(" 450000 ")).toBe(450000);
    expect(parseRupiahInput("")).toBeNull();
    expect(parseRupiahInput("12,5")).toBeNaN();
  });

  it("paket berbayar wajib tanggal akhir, Benih tidak", () => {
    const base = { companyId: id, cycle: "bulanan", price: null, reason: "Bayar transfer" };
    expect(setPlanSchema.safeParse({ ...base, planCode: "tunas_plus" }).success).toBe(false);
    expect(setPlanSchema.safeParse({ ...base, planCode: "tunas_plus", periodEnd: "2026-11-30" }).success).toBe(true);
    expect(setPlanSchema.safeParse({ ...base, planCode: "benih" }).success).toBe(true);
  });

  it("alasan wajib minimal 5 huruf", () => {
    const r = extendTrialSchema.safeParse({ companyId: id, days: "7", reason: " ok " });
    expect(r.success).toBe(false);
  });

  it("perpanjang trial 1–30 hari", () => {
    expect(extendTrialSchema.safeParse({ companyId: id, days: "31", reason: "Minta waktu" }).success).toBe(false);
    expect(extendTrialSchema.safeParse({ companyId: id, days: "14", reason: "Minta waktu" }).success).toBe(true);
  });
});
