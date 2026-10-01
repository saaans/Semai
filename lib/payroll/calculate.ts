/**
 * Hitung slip gaji satu karyawan untuk satu periode. Fungsi murni, tanpa
 * query, supaya bisa dites dan hasilnya sama di pratinjau maupun saat kunci.
 *
 * Semua uang integer rupiah. Pembulatan dilakukan sekali per baris
 * (setengah ke atas) dari perkalian bulat, tidak ada float yang menumpuk.
 */
import { formatMinutes, formatRupiah } from "@/lib/format";

export const RULE_KINDS = ["tunjangan", "lembur", "potongan"] as const;
export type RuleKind = (typeof RULE_KINDS)[number];

export const RULE_CALCS = [
  "tetap_bulanan",
  "per_hari_hadir",
  "per_jam",
  "per_menit",
  "per_kejadian",
  "proporsional_gaji_harian",
] as const;
export type RuleCalc = (typeof RULE_CALCS)[number];

export const TRIGGER_EVENTS = ["telat", "pulang_cepat", "alpa"] as const;
export type TriggerEvent = (typeof TRIGGER_EVENTS)[number];

export type PayrollRule = {
  id: string;
  kind: RuleKind;
  name: string;
  calc: RuleCalc;
  /** null hanya untuk proporsional_gaji_harian. */
  amount: number | null;
  triggerEvent: TriggerEvent | null;
};

/** Cara menghitung gaji harian untuk potongan proporsional. */
export type DayBasis = { kind: "jadwal" } | { kind: "tetap"; days: number };

export type AttendanceTotals = {
  hadir: number;
  telatKali: number;
  telatMenit: number;
  pulangCepatKali: number;
  pulangCepatMenit: number;
  /** Alpa + hari kerja yang lewat tanpa absen. */
  alpa: number;
  izin: number;
  /** Hanya lembur yang disetujui. */
  lemburMenit: number;
  lemburHari: number;
};

export type CashAdvanceInput = { id: string; balance: number; installment: number };
export type AdjustmentInput = { id: string; amount: number; reason: string };

export type PayslipInput = {
  /** Gaji pokok sebulan penuh. */
  baseSalary: number;
  /** Hari kerja terjadwal sebulan penuh. */
  monthWorkDays: number;
  /** Hari kerja terjadwal selama karyawan bekerja di periode ini (prorata). */
  employedWorkDays: number;
  /** Durasi kerja per hari dalam menit, untuk potongan proporsional per menit. */
  dailyMinutes: number;
  dayBasis: DayBasis;
  rules: PayrollRule[];
  attendance: AttendanceTotals;
  /** Kasbon aktif, urut dari yang paling lama. */
  cashAdvances: CashAdvanceInput[];
  adjustments: AdjustmentInput[];
};

export type LineGroup = "pokok" | "tunjangan" | "lembur" | "potongan" | "kasbon" | "penyesuaian";

export type PayslipLine = {
  group: LineGroup;
  label: string;
  /** Rincian hitungan, contoh "22 hari × Rp25.000". */
  detail: string;
  /** Selalu positif, kecuali penyesuaian (bisa minus). */
  amount: number;
  ruleId?: string;
  cashAdvanceId?: string;
  adjustmentId?: string;
};

export type PayslipResult = {
  /** Gaji pokok setelah prorata. */
  baseSalary: number;
  totalAllowances: number;
  totalOvertime: number;
  totalDeductions: number;
  cashAdvanceDeduction: number;
  adjustment: number;
  netPay: number;
  lines: PayslipLine[];
  cashAdvanceDeductions: { id: string; amount: number }[];
  /** Penyesuaian minus lebih besar dari gaji: slip tidak bisa dikunci. */
  negative: boolean;
};

/** Durasi kerja default kalau karyawan tidak punya jadwal: 8 jam. */
export const DEFAULT_DAILY_MINUTES = 8 * 60;
/** Pembagi gaji harian kalau hari kerja terjadwal nol. */
const FALLBACK_DAYS = 30;

function assertInt(value: number, name: string) {
  if (!Number.isSafeInteger(value)) throw new Error(`${name} harus bilangan bulat, dapat ${value}`);
}

/** round(a × b ÷ c), setengah ke atas. Semua argumen bulat, c > 0. */
export function mulDiv(a: number, b: number, c: number): number {
  assertInt(a, "a");
  assertInt(b, "b");
  assertInt(c, "c");
  if (c <= 0) throw new Error("Pembagi harus lebih dari nol");
  const product = a * b;
  if (!Number.isSafeInteger(product)) throw new Error("Angka terlalu besar untuk dihitung");
  const sign = product < 0 ? -1 : 1;
  return sign * Math.floor((Math.abs(product) * 2 + c) / (2 * c));
}

function rp(amount: number) {
  return formatRupiah(amount);
}

const EVENT_LABEL: Record<TriggerEvent, string> = {
  telat: "telat",
  pulang_cepat: "pulang cepat",
  alpa: "tidak masuk",
};

/** Hari pembagi gaji harian. */
export function dailyDivisor(basis: DayBasis, monthWorkDays: number): number {
  if (basis.kind === "tetap") return basis.days > 0 ? basis.days : FALLBACK_DAYS;
  return monthWorkDays > 0 ? monthWorkDays : FALLBACK_DAYS;
}

/** Nominal satu aturan, atau null kalau kombinasi aturan tidak dikenal. */
function ruleLine(rule: PayrollRule, input: PayslipInput, prorate: (n: number) => number): PayslipLine | null {
  const { attendance: a } = input;
  const amount = rule.amount ?? 0;
  const base = { label: rule.name, ruleId: rule.id };

  if (rule.kind === "tunjangan") {
    if (rule.calc === "tetap_bulanan") {
      const value = prorate(amount);
      const detail = value === amount ? "Per bulan" : `Prorata ${input.employedWorkDays}/${input.monthWorkDays} hari kerja`;
      return { ...base, group: "tunjangan", detail, amount: value };
    }
    if (rule.calc === "per_hari_hadir") {
      return { ...base, group: "tunjangan", detail: `${a.hadir} hari hadir × ${rp(amount)}`, amount: amount * a.hadir };
    }
    return null;
  }

  if (rule.kind === "lembur") {
    if (rule.calc === "per_jam") {
      return {
        ...base,
        group: "lembur",
        detail: `${formatMinutes(a.lemburMenit)} × ${rp(amount)}/jam`,
        amount: mulDiv(amount, a.lemburMenit, 60),
      };
    }
    if (rule.calc === "per_kejadian") {
      return { ...base, group: "lembur", detail: `${a.lemburHari} hari lembur × ${rp(amount)}`, amount: amount * a.lemburHari };
    }
    return null;
  }

  // Potongan selalu terikat kejadian: telat, pulang cepat, atau tidak masuk.
  const event = rule.triggerEvent;
  if (!event) return null;
  const times = event === "telat" ? a.telatKali : event === "pulang_cepat" ? a.pulangCepatKali : a.alpa;
  const minutes = event === "telat" ? a.telatMenit : event === "pulang_cepat" ? a.pulangCepatMenit : 0;
  const unit = event === "alpa" ? "hari" : "kali";
  const divisor = dailyDivisor(input.dayBasis, input.monthWorkDays);

  if (rule.calc === "per_kejadian") {
    return { ...base, group: "potongan", detail: `${times} ${unit} ${EVENT_LABEL[event]} × ${rp(amount)}`, amount: amount * times };
  }
  if (rule.calc === "per_menit" && event !== "alpa") {
    return {
      ...base,
      group: "potongan",
      detail: `${minutes} menit ${EVENT_LABEL[event]} × ${rp(amount)}`,
      amount: amount * minutes,
    };
  }
  if (rule.calc === "proporsional_gaji_harian") {
    const daily = mulDiv(input.baseSalary, 1, divisor);
    if (event === "alpa") {
      return {
        ...base,
        group: "potongan",
        detail: `${times} hari tidak masuk × gaji harian ${rp(daily)}`,
        amount: mulDiv(input.baseSalary, times, divisor),
      };
    }
    const dailyMinutes = input.dailyMinutes > 0 ? input.dailyMinutes : DEFAULT_DAILY_MINUTES;
    return {
      ...base,
      group: "potongan",
      detail: `${minutes} menit ${EVENT_LABEL[event]} × gaji harian ${rp(daily)} ÷ ${formatMinutes(dailyMinutes)}`,
      amount: mulDiv(input.baseSalary, minutes, divisor * dailyMinutes),
    };
  }
  return null;
}

export function calculatePayslip(input: PayslipInput): PayslipResult {
  assertInt(input.baseSalary, "baseSalary");
  assertInt(input.monthWorkDays, "monthWorkDays");
  assertInt(input.employedWorkDays, "employedWorkDays");
  for (const rule of input.rules) if (rule.amount !== null) assertInt(rule.amount, `aturan ${rule.name}`);
  for (const adv of input.cashAdvances) {
    assertInt(adv.balance, "kasbon");
    assertInt(adv.installment, "cicilan kasbon");
  }
  for (const adj of input.adjustments) assertInt(adj.amount, "penyesuaian");

  const fullMonth = input.monthWorkDays <= 0 || input.employedWorkDays >= input.monthWorkDays;
  const prorate = (amount: number) =>
    fullMonth ? amount : mulDiv(amount, Math.max(input.employedWorkDays, 0), input.monthWorkDays);

  const lines: PayslipLine[] = [];
  const baseSalary = prorate(input.baseSalary);
  lines.push({
    group: "pokok",
    label: "Gaji pokok",
    detail: fullMonth ? "Per bulan" : `Prorata ${Math.max(input.employedWorkDays, 0)}/${input.monthWorkDays} hari kerja`,
    amount: baseSalary,
  });

  let totalAllowances = 0;
  let totalOvertime = 0;
  const deductionLines: PayslipLine[] = [];
  for (const rule of input.rules) {
    const line = ruleLine(rule, input, prorate);
    if (!line || line.amount <= 0) continue;
    if (line.group === "tunjangan") {
      totalAllowances += line.amount;
      lines.push(line);
    } else if (line.group === "lembur") {
      totalOvertime += line.amount;
      lines.push(line);
    } else {
      deductionLines.push(line);
    }
  }

  let adjustment = 0;
  for (const adj of input.adjustments) {
    if (adj.amount === 0) continue;
    adjustment += adj.amount;
    lines.push({ group: "penyesuaian", label: "Penyesuaian", detail: adj.reason, amount: adj.amount, adjustmentId: adj.id });
  }

  let remaining = baseSalary + totalAllowances + totalOvertime + adjustment;
  const negative = remaining < 0;
  if (negative) remaining = 0;

  // Potongan dan kasbon tidak boleh membuat gaji bersih minus.
  let totalDeductions = 0;
  for (const line of deductionLines) {
    const amount = Math.min(line.amount, remaining);
    if (amount <= 0) continue;
    remaining -= amount;
    totalDeductions += amount;
    lines.push(amount < line.amount ? { ...line, amount, detail: `${line.detail} (dibatasi sisa gaji)` } : line);
  }

  let cashAdvanceDeduction = 0;
  const cashAdvanceDeductions: { id: string; amount: number }[] = [];
  for (const adv of input.cashAdvances) {
    const planned = Math.min(adv.installment, adv.balance);
    const amount = Math.min(planned, remaining);
    if (amount <= 0) continue;
    remaining -= amount;
    cashAdvanceDeduction += amount;
    cashAdvanceDeductions.push({ id: adv.id, amount });
    const after = adv.balance - amount;
    const detail =
      (amount < planned ? `Cicilan dibatasi sisa gaji. ` : "") +
      (after === 0 ? "Lunas" : `Sisa ${rp(after)}`);
    lines.push({ group: "kasbon", label: "Cicilan kasbon", detail, amount, cashAdvanceId: adv.id });
  }

  return {
    baseSalary,
    totalAllowances,
    totalOvertime,
    totalDeductions,
    cashAdvanceDeduction,
    adjustment,
    netPay: remaining,
    lines,
    cashAdvanceDeductions,
    negative,
  };
}
