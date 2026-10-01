import { describe, expect, it } from "vitest";
import { attendanceTotals, countWorkDays, employmentRange, scheduleMinutes, type PayrollAttendanceRow } from "./attendance";
import { calculatePayslip, mulDiv, type AttendanceTotals, type PayrollRule, type PayslipInput } from "./calculate";

const NO_ATTENDANCE: AttendanceTotals = {
  hadir: 0,
  telatKali: 0,
  telatMenit: 0,
  pulangCepatKali: 0,
  pulangCepatMenit: 0,
  alpa: 0,
  izin: 0,
  lemburMenit: 0,
  lemburHari: 0,
};

function input(overrides: Partial<PayslipInput> = {}): PayslipInput {
  return {
    baseSalary: 3_000_000,
    monthWorkDays: 26,
    employedWorkDays: 26,
    dailyMinutes: 480,
    dayBasis: { kind: "jadwal" },
    rules: [],
    attendance: { ...NO_ATTENDANCE, hadir: 26 },
    cashAdvances: [],
    adjustments: [],
    ...overrides,
  };
}

function rule(partial: Partial<PayrollRule> & Pick<PayrollRule, "kind" | "calc">): PayrollRule {
  return { id: `r-${partial.kind}-${partial.calc}`, name: partial.kind, amount: 0, triggerEvent: null, ...partial };
}

describe("mulDiv", () => {
  it("membulatkan setengah ke atas", () => {
    expect(mulDiv(10, 1, 4)).toBe(3); // 2,5 → 3
    expect(mulDiv(10, 1, 3)).toBe(3); // 3,33 → 3
    expect(mulDiv(20, 1, 3)).toBe(7); // 6,67 → 7
    expect(mulDiv(-10, 1, 4)).toBe(-3);
  });

  it("menolak angka pecahan dan pembagi nol", () => {
    expect(() => mulDiv(1.5, 1, 1)).toThrow();
    expect(() => mulDiv(1, 1, 0)).toThrow();
  });
});

describe("calculatePayslip", () => {
  it("gaji pokok saja", () => {
    const result = calculatePayslip(input());
    expect(result.baseSalary).toBe(3_000_000);
    expect(result.netPay).toBe(3_000_000);
    expect(result.lines).toHaveLength(1);
    expect(result.negative).toBe(false);
  });

  it("prorata gaji pokok dan tunjangan tetap untuk karyawan baru", () => {
    const result = calculatePayslip(
      input({
        employedWorkDays: 13,
        rules: [rule({ kind: "tunjangan", calc: "tetap_bulanan", amount: 500_001, name: "Transport" })],
      }),
    );
    expect(result.baseSalary).toBe(1_500_000);
    expect(result.totalAllowances).toBe(250_001); // 250.000,5 → 250.001
    expect(result.netPay).toBe(1_750_001);
    expect(result.lines[0]?.detail).toBe("Prorata 13/26 hari kerja");
  });

  it("tunjangan per hari hadir", () => {
    const result = calculatePayslip(
      input({
        attendance: { ...NO_ATTENDANCE, hadir: 22 },
        rules: [rule({ kind: "tunjangan", calc: "per_hari_hadir", amount: 25_000, name: "Uang makan" })],
      }),
    );
    expect(result.totalAllowances).toBe(550_000);
    expect(result.lines[1]?.detail).toBe("22 hari hadir × Rp25.000");
  });

  it("lembur per jam dihitung per menit", () => {
    const result = calculatePayslip(
      input({
        attendance: { ...NO_ATTENDANCE, hadir: 26, lemburMenit: 90, lemburHari: 1 },
        rules: [rule({ kind: "lembur", calc: "per_jam", amount: 20_000 })],
      }),
    );
    expect(result.totalOvertime).toBe(30_000);
  });

  it("lembur per jam membulatkan rupiah", () => {
    const result = calculatePayslip(
      input({
        attendance: { ...NO_ATTENDANCE, lemburMenit: 7 },
        rules: [rule({ kind: "lembur", calc: "per_jam", amount: 15_000 })],
      }),
    );
    expect(result.totalOvertime).toBe(1_750);
  });

  it("lembur per kejadian", () => {
    const result = calculatePayslip(
      input({
        attendance: { ...NO_ATTENDANCE, lemburMenit: 300, lemburHari: 3 },
        rules: [rule({ kind: "lembur", calc: "per_kejadian", amount: 50_000 })],
      }),
    );
    expect(result.totalOvertime).toBe(150_000);
  });

  it("potongan telat per menit, per kejadian, dan proporsional", () => {
    const attendance = { ...NO_ATTENDANCE, hadir: 26, telatKali: 3, telatMenit: 45 };
    const perMenit = calculatePayslip(
      input({ attendance, rules: [rule({ kind: "potongan", calc: "per_menit", amount: 1_000, triggerEvent: "telat" })] }),
    );
    expect(perMenit.totalDeductions).toBe(45_000);

    const perKejadian = calculatePayslip(
      input({ attendance, rules: [rule({ kind: "potongan", calc: "per_kejadian", amount: 20_000, triggerEvent: "telat" })] }),
    );
    expect(perKejadian.totalDeductions).toBe(60_000);

    // 3.000.000 ÷ 26 hari ÷ 480 menit × 45 menit = 10.817,3 → 10.817
    const proporsional = calculatePayslip(
      input({
        attendance,
        rules: [rule({ kind: "potongan", calc: "proporsional_gaji_harian", amount: null, triggerEvent: "telat" })],
      }),
    );
    expect(proporsional.totalDeductions).toBe(10_817);
    expect(proporsional.netPay).toBe(3_000_000 - 10_817);
  });

  it("potongan tidak masuk proporsional, basis jadwal atau angka tetap", () => {
    const attendance = { ...NO_ATTENDANCE, hadir: 24, alpa: 2 };
    const rules = [rule({ kind: "potongan" as const, calc: "proporsional_gaji_harian" as const, amount: null, triggerEvent: "alpa" as const })];

    // 3.000.000 × 2 ÷ 26 = 230.769,2
    expect(calculatePayslip(input({ attendance, rules })).totalDeductions).toBe(230_769);
    // 3.000.000 × 2 ÷ 30 = 200.000
    expect(calculatePayslip(input({ attendance, rules, dayBasis: { kind: "tetap", days: 30 } })).totalDeductions).toBe(200_000);
  });

  it("gaji harian memakai gaji pokok penuh walau prorata", () => {
    const result = calculatePayslip(
      input({
        employedWorkDays: 13,
        attendance: { ...NO_ATTENDANCE, alpa: 1 },
        rules: [rule({ kind: "potongan", calc: "proporsional_gaji_harian", amount: null, triggerEvent: "alpa" })],
      }),
    );
    expect(result.totalDeductions).toBe(115_385); // 3.000.000 ÷ 26
  });

  it("potongan pulang cepat per menit", () => {
    const result = calculatePayslip(
      input({
        attendance: { ...NO_ATTENDANCE, pulangCepatKali: 2, pulangCepatMenit: 30 },
        rules: [rule({ kind: "potongan", calc: "per_menit", amount: 500, triggerEvent: "pulang_cepat" })],
      }),
    );
    expect(result.totalDeductions).toBe(15_000);
  });

  it("aturan tidak dikenal dan nominal nol dilewati", () => {
    const result = calculatePayslip(
      input({
        attendance: { ...NO_ATTENDANCE, alpa: 2, telatKali: 1, telatMenit: 10 },
        rules: [
          rule({ kind: "potongan", calc: "per_menit", amount: 1_000, triggerEvent: "alpa" }),
          rule({ kind: "potongan", calc: "per_kejadian", amount: 1_000, triggerEvent: null }),
          rule({ kind: "tunjangan", calc: "per_jam", amount: 1_000 }),
          rule({ kind: "potongan", calc: "per_kejadian", amount: 0, triggerEvent: "telat" }),
        ],
      }),
    );
    expect(result.lines).toHaveLength(1);
    expect(result.netPay).toBe(3_000_000);
  });

  it("cicilan kasbon dipotong sesuai cicilan dan sisa saldo", () => {
    const result = calculatePayslip(
      input({
        cashAdvances: [
          { id: "a", balance: 300_000, installment: 500_000 },
          { id: "b", balance: 1_000_000, installment: 250_000 },
        ],
      }),
    );
    expect(result.cashAdvanceDeductions).toEqual([
      { id: "a", amount: 300_000 },
      { id: "b", amount: 250_000 },
    ]);
    expect(result.cashAdvanceDeduction).toBe(550_000);
    expect(result.netPay).toBe(2_450_000);
    expect(result.lines.find((l) => l.cashAdvanceId === "a")?.detail).toBe("Lunas");
    expect(result.lines.find((l) => l.cashAdvanceId === "b")?.detail).toBe("Sisa Rp750.000");
  });

  it("kasbon lebih besar dari gaji: gaji bersih nol, sisa tetap di saldo", () => {
    const result = calculatePayslip(
      input({
        baseSalary: 1_000_000,
        rules: [rule({ kind: "potongan", calc: "per_kejadian", amount: 100_000, triggerEvent: "alpa" })],
        attendance: { ...NO_ATTENDANCE, alpa: 2 },
        cashAdvances: [{ id: "a", balance: 2_000_000, installment: 2_000_000 }],
      }),
    );
    expect(result.totalDeductions).toBe(200_000);
    expect(result.cashAdvanceDeductions).toEqual([{ id: "a", amount: 800_000 }]);
    expect(result.netPay).toBe(0);
    expect(result.negative).toBe(false);
  });

  it("potongan lebih besar dari gaji dibatasi", () => {
    const result = calculatePayslip(
      input({
        baseSalary: 100_000,
        attendance: { ...NO_ATTENDANCE, telatMenit: 500, telatKali: 5 },
        rules: [rule({ kind: "potongan", calc: "per_menit", amount: 1_000, triggerEvent: "telat" })],
      }),
    );
    expect(result.totalDeductions).toBe(100_000);
    expect(result.netPay).toBe(0);
    expect(result.lines.at(-1)?.detail).toContain("dibatasi sisa gaji");
  });

  it("penyesuaian plus dan minus", () => {
    const result = calculatePayslip(
      input({
        adjustments: [
          { id: "x", amount: 150_000, reason: "Lembur Agustus belum dibayar" },
          { id: "y", amount: -50_000, reason: "Kelebihan bayar" },
        ],
      }),
    );
    expect(result.adjustment).toBe(100_000);
    expect(result.netPay).toBe(3_100_000);
  });

  it("penyesuaian minus melebihi gaji ditandai negatif", () => {
    const result = calculatePayslip(input({ baseSalary: 100_000, adjustments: [{ id: "x", amount: -200_000, reason: "x" }] }));
    expect(result.negative).toBe(true);
    expect(result.netPay).toBe(0);
  });

  it("persamaan gaji bersih selalu cocok", () => {
    const result = calculatePayslip(
      input({
        attendance: { ...NO_ATTENDANCE, hadir: 20, telatKali: 2, telatMenit: 17, alpa: 1, lemburMenit: 125, lemburHari: 2 },
        rules: [
          rule({ kind: "tunjangan", calc: "per_hari_hadir", amount: 15_000 }),
          rule({ kind: "lembur", calc: "per_jam", amount: 17_500 }),
          rule({ kind: "potongan", calc: "proporsional_gaji_harian", amount: null, triggerEvent: "telat" }),
          rule({ kind: "potongan", calc: "proporsional_gaji_harian", amount: null, triggerEvent: "alpa" }),
        ],
        cashAdvances: [{ id: "a", balance: 400_000, installment: 100_000 }],
        adjustments: [{ id: "x", amount: 12_345, reason: "x" }],
      }),
    );
    expect(result.netPay).toBe(
      result.baseSalary +
        result.totalAllowances +
        result.totalOvertime +
        result.adjustment -
        result.totalDeductions -
        result.cashAdvanceDeduction,
    );
    for (const line of result.lines) expect(Number.isInteger(line.amount)).toBe(true);
  });

  it("menolak nominal pecahan", () => {
    expect(() => calculatePayslip(input({ baseSalary: 1000.5 }))).toThrow();
  });
});

describe("hari kerja dan rentang", () => {
  const senJum = { start_time: "08:00:00", end_time: "17:00:00", work_days: [1, 2, 3, 4, 5] };

  it("menghitung hari kerja terjadwal", () => {
    // Oktober 2026: 1 Okt = Kamis. Senin–Jumat = 22 hari.
    expect(countWorkDays("2026-10-01", "2026-10-31", senJum)).toBe(22);
    expect(countWorkDays("2026-10-01", "2026-10-31", null)).toBe(31);
    expect(countWorkDays("2026-10-05", "2026-10-04", senJum)).toBe(0);
  });

  it("durasi jadwal, termasuk shift malam", () => {
    expect(scheduleMinutes(senJum)).toBe(540);
    expect(scheduleMinutes({ start_time: "22:00", end_time: "06:00", work_days: [] })).toBe(480);
    expect(scheduleMinutes(null)).toBe(480);
  });

  it("rentang kerja: mulai kerja, aktivasi, nonaktif", () => {
    expect(
      employmentRange({ start: "2026-10-01", end: "2026-10-31", joinedOn: "2026-10-10", activatedOn: "2026-10-12", deactivatedOn: null }),
    ).toEqual({ employed: { begin: "2026-10-10", end: "2026-10-31" }, counted: { begin: "2026-10-12", end: "2026-10-31" } });

    expect(
      employmentRange({ start: "2026-10-01", end: "2026-10-31", joinedOn: null, activatedOn: "2026-08-01", deactivatedOn: "2026-10-15" }),
    ).toEqual({ employed: { begin: "2026-10-01", end: "2026-10-15" }, counted: { begin: "2026-10-01", end: "2026-10-15" } });
  });

  it("ringkasan absen untuk gajian", () => {
    const row = (work_date: string, extra: Partial<PayrollAttendanceRow> = {}): PayrollAttendanceRow => ({
      work_date,
      status: "hadir",
      late_minutes: 0,
      early_leave_minutes: 0,
      overtime_minutes: 0,
      overtime_status: null,
      ...extra,
    });
    const totals = attendanceTotals(
      [
        row("2026-10-01", { late_minutes: 10 }),
        row("2026-10-02", { early_leave_minutes: 15, overtime_minutes: 60, overtime_status: "ditolak" }),
        row("2026-10-05", { overtime_minutes: 90, overtime_status: "disetujui" }),
        row("2026-10-06", { overtime_minutes: 30, overtime_status: "menunggu" }),
        row("2026-10-07", { status: "sakit" }),
        // 8 Okt tanpa catatan = tidak masuk
      ],
      { begin: "2026-10-01", end: "2026-10-09", today: "2026-10-09", schedule: senJum },
    );
    expect(totals).toEqual({
      hadir: 4,
      telatKali: 1,
      telatMenit: 10,
      pulangCepatKali: 1,
      pulangCepatMenit: 15,
      alpa: 1,
      izin: 1,
      lemburMenit: 90,
      lemburHari: 1,
    });
  });
});
