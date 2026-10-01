import { describe, expect, it } from "vitest";
import { isValidCombo, parseRupiah, ruleSchema, toPayrollRule } from "./rules";

describe("parseRupiah", () => {
  it("menerima format rupiah umum", () => {
    expect(parseRupiah("1.250.000")).toBe(1_250_000);
    expect(parseRupiah("Rp1.250.000")).toBe(1_250_000);
    expect(parseRupiah(" 25000 ")).toBe(25_000);
    expect(parseRupiah("-150.000")).toBe(-150_000);
  });

  it("menolak pecahan dan teks", () => {
    expect(parseRupiah("1,5")).toBeNaN();
    expect(parseRupiah("abc")).toBeNaN();
    expect(parseRupiah("")).toBeNaN();
  });
});

describe("kombinasi aturan", () => {
  it("sama dengan RPC validate_payroll_rule", () => {
    expect(isValidCombo("tunjangan", "per_hari_hadir", null)).toBe(true);
    expect(isValidCombo("tunjangan", "per_jam", null)).toBe(false);
    expect(isValidCombo("lembur", "per_jam", null)).toBe(true);
    expect(isValidCombo("potongan", "per_menit", "telat")).toBe(true);
    expect(isValidCombo("potongan", "per_menit", "alpa")).toBe(false);
    expect(isValidCombo("potongan", "per_kejadian", null)).toBe(false);
    expect(isValidCombo("tunjangan", "tetap_bulanan", "telat")).toBe(false);
  });

  it("baris tidak dikenal dilewati", () => {
    const base = { id: "x", name: "x", amount: 0, trigger_event: null };
    expect(toPayrollRule({ ...base, kind: "bonus", calc: "per_jam" })).toBeNull();
    expect(toPayrollRule({ ...base, kind: "lembur", calc: "per_jam" })?.calc).toBe("per_jam");
  });
});

describe("ruleSchema", () => {
  const form = {
    ruleId: "",
    kind: "potongan",
    name: "Potongan telat",
    calc: "per_menit",
    triggerEvent: "telat",
    amount: "1.000",
    employeeId: "",
    isActive: true,
    reason: "",
  };

  it("aturan baru tanpa alasan", () => {
    const parsed = ruleSchema.parse(form);
    expect(parsed).toMatchObject({ amount: 1000, triggerEvent: "telat", ruleId: null, employeeId: null });
  });

  it("proporsional tanpa nominal", () => {
    const parsed = ruleSchema.parse({ ...form, calc: "proporsional_gaji_harian", amount: "" });
    expect(parsed.amount).toBeNull();
  });

  it("ubah aturan wajib alasan", () => {
    const result = ruleSchema.safeParse({ ...form, ruleId: "3f2a9c1e-1234-4abc-8def-1234567890ab" });
    expect(result.success).toBe(false);
  });

  it("tunjangan mengabaikan kejadian", () => {
    const parsed = ruleSchema.parse({ ...form, kind: "tunjangan", calc: "per_hari_hadir", triggerEvent: "telat" });
    expect(parsed.triggerEvent).toBeNull();
  });
});
