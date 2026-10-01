/**
 * Label, pilihan, dan validasi aturan gaji. Aman dipakai di komponen client.
 * Kombinasi yang sah sama dengan RPC validate_payroll_rule.
 */
import { z } from "zod";
import {
  RULE_CALCS,
  RULE_KINDS,
  TRIGGER_EVENTS,
  type PayrollRule,
  type RuleCalc,
  type RuleKind,
  type TriggerEvent,
} from "./calculate";

export const KIND_LABEL: Record<RuleKind, string> = {
  tunjangan: "Tunjangan",
  lembur: "Lembur",
  potongan: "Potongan",
};

export const EVENT_LABEL: Record<TriggerEvent, string> = {
  telat: "Telat",
  pulang_cepat: "Pulang cepat",
  alpa: "Tidak masuk",
};

/** Cara hitung yang boleh dipilih per jenis (dan per kejadian untuk potongan). */
export function calcOptions(kind: RuleKind, event: TriggerEvent | null): { value: RuleCalc; label: string }[] {
  if (kind === "tunjangan") {
    return [
      { value: "tetap_bulanan", label: "Per bulan" },
      { value: "per_hari_hadir", label: "Per hari hadir" },
    ];
  }
  if (kind === "lembur") {
    return [
      { value: "per_jam", label: "Per jam" },
      { value: "per_kejadian", label: "Per hari lembur" },
    ];
  }
  if (event === "alpa") {
    return [
      { value: "per_kejadian", label: "Per hari" },
      { value: "proporsional_gaji_harian", label: "Gaji harian" },
    ];
  }
  return [
    { value: "per_menit", label: "Per menit" },
    { value: "per_kejadian", label: "Per kejadian" },
    { value: "proporsional_gaji_harian", label: "Proporsional" },
  ];
}

export function isValidCombo(kind: RuleKind, calc: RuleCalc, event: TriggerEvent | null): boolean {
  if (kind === "potongan" && !event) return false;
  if (kind !== "potongan" && event) return false;
  return calcOptions(kind, event).some((o) => o.value === calc);
}

/** Ringkasan cara hitung untuk daftar aturan, contoh "Rp25.000 per hari hadir". */
export function describeRule(rule: Pick<PayrollRule, "kind" | "calc" | "triggerEvent">, amountText: string): string {
  const event = rule.triggerEvent;
  switch (rule.calc) {
    case "tetap_bulanan":
      return `${amountText} per bulan`;
    case "per_hari_hadir":
      return `${amountText} per hari hadir`;
    case "per_jam":
      return `${amountText} per jam, dihitung per menit`;
    case "per_menit":
      return `${amountText} per menit ${event ? EVENT_LABEL[event].toLowerCase() : ""}`.trim();
    case "per_kejadian":
      if (rule.kind === "lembur") return `${amountText} per hari lembur`;
      return event === "alpa" ? `${amountText} per hari tidak masuk` : `${amountText} per kejadian ${event ? EVENT_LABEL[event].toLowerCase() : ""}`.trim();
    case "proporsional_gaji_harian":
      return event === "alpa"
        ? "Gaji harian × hari tidak masuk"
        : `Gaji harian ÷ jam kerja × menit ${event ? EVENT_LABEL[event].toLowerCase() : ""}`.trim();
  }
}

function isKind(v: string): v is RuleKind {
  return (RULE_KINDS as readonly string[]).includes(v);
}
function isCalc(v: string): v is RuleCalc {
  return (RULE_CALCS as readonly string[]).includes(v);
}
function isEvent(v: string | null): v is TriggerEvent {
  return v !== null && (TRIGGER_EVENTS as readonly string[]).includes(v);
}

/** Baris payroll_rules → aturan untuk lib/payroll. null = data tidak dikenal (dilewati). */
export function toPayrollRule(row: {
  id: string;
  kind: string;
  name: string;
  calc: string;
  amount: number | null;
  trigger_event: string | null;
}): PayrollRule | null {
  if (!isKind(row.kind) || !isCalc(row.calc)) return null;
  const event = isEvent(row.trigger_event) ? row.trigger_event : null;
  if (!isValidCombo(row.kind, row.calc, event)) return null;
  return { id: row.id, kind: row.kind, name: row.name, calc: row.calc, amount: row.amount, triggerEvent: event };
}

// -----------------------------------------------------------------------------
// Form
// -----------------------------------------------------------------------------

/** "Rp1.250.000", "1.250.000", "1250000" → 1250000. Kosong/salah → NaN. */
export function parseRupiah(value: string): number {
  const digits = value.replace(/^\s*-?\s*(rp)?/i, "").replace(/[.\s]/g, "");
  if (!/^\d{1,12}$/.test(digits)) return Number.NaN;
  const amount = Number(digits);
  return /^\s*-/.test(value) ? -amount : amount;
}

const rupiah = (message: string) =>
  z
    .string()
    .transform((v) => parseRupiah(v))
    .pipe(z.number({ error: message }).int({ error: message }));

const reason = z
  .string()
  .trim()
  .min(5, { error: 'Tulis alasan minimal 5 huruf, misalnya "Naik gaji setelah 1 tahun".' })
  .max(300, { error: "Alasan terlalu panjang. Maksimal 300 huruf." });

export const baseSalarySchema = z.object({
  employeeId: z.uuid({ error: "Karyawan tidak dikenal. Muat ulang halaman." }),
  amount: rupiah("Isi gaji pokok dengan angka, contoh 3.000.000.").pipe(
    z.number().min(0).max(1_000_000_000, { error: "Gaji pokok maksimal Rp1.000.000.000." }),
  ),
  reason,
});

export const ruleSchema = z
  .object({
    ruleId: z.union([z.uuid(), z.literal("")]),
    kind: z.enum(RULE_KINDS, { error: "Pilih jenis: tunjangan, lembur, atau potongan." }),
    name: z
      .string()
      .trim()
      .min(1, { error: 'Isi nama komponen, contoh "Uang makan".' })
      .max(60, { error: "Nama maksimal 60 huruf." }),
    calc: z.enum(RULE_CALCS, { error: "Pilih cara hitung." }),
    triggerEvent: z.union([z.enum(TRIGGER_EVENTS), z.literal("")]),
    amount: z.string(),
    employeeId: z.union([z.uuid(), z.literal("")]),
    isActive: z.boolean(),
    reason: z.string().trim().max(300, { error: "Alasan terlalu panjang. Maksimal 300 huruf." }),
  })
  .transform((v, ctx) => {
    const event = v.kind === "potongan" && v.triggerEvent ? v.triggerEvent : null;
    if (v.kind === "potongan" && !event) {
      ctx.addIssue({ code: "custom", path: ["triggerEvent"], message: "Pilih potongan untuk telat, pulang cepat, atau tidak masuk." });
      return z.NEVER;
    }
    if (!isValidCombo(v.kind, v.calc, event)) {
      ctx.addIssue({ code: "custom", path: ["calc"], message: "Pilih cara hitung yang tersedia." });
      return z.NEVER;
    }
    let amount: number | null = null;
    if (v.calc !== "proporsional_gaji_harian") {
      amount = parseRupiah(v.amount);
      if (!Number.isSafeInteger(amount) || amount < 0 || amount > 100_000_000) {
        ctx.addIssue({ code: "custom", path: ["amount"], message: "Isi nominal dengan angka, contoh 25.000. Maksimal Rp100.000.000." });
        return z.NEVER;
      }
    }
    if (v.ruleId && v.reason.length < 5) {
      ctx.addIssue({ code: "custom", path: ["reason"], message: 'Tulis alasan perubahan minimal 5 huruf, misalnya "Harga makan naik".' });
      return z.NEVER;
    }
    return {
      ruleId: v.ruleId || null,
      kind: v.kind,
      name: v.name,
      calc: v.calc,
      triggerEvent: event,
      amount,
      employeeId: v.employeeId || null,
      isActive: v.isActive,
      reason: v.reason || null,
    };
  });

export const deleteRuleSchema = z.object({
  ruleId: z.uuid({ error: "Aturan tidak dikenal. Muat ulang halaman." }),
  reason,
});

export const settingsSchema = z.object({
  dayBasis: z.enum(["jadwal", "tetap"], { error: "Pilih cara hitung gaji harian." }),
  fixedDays: z.coerce
    .number({ error: "Isi jumlah hari antara 20 dan 31." })
    .int({ error: "Isi jumlah hari antara 20 dan 31." })
    .min(20, { error: "Isi jumlah hari antara 20 dan 31." })
    .max(31, { error: "Isi jumlah hari antara 20 dan 31." }),
});

export const adjustmentSchema = z.object({
  employeeId: z.uuid({ error: "Karyawan tidak dikenal. Muat ulang halaman." }),
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, { error: "Bulan tidak valid. Muat ulang halaman." }),
  direction: z.enum(["tambah", "kurang"], { error: "Pilih tambah atau kurangi gaji." }),
  amount: rupiah("Isi nominal dengan angka, contoh 150.000.").pipe(
    z
      .number()
      .min(1, { error: "Isi nominal lebih dari Rp0." })
      .max(100_000_000, { error: "Nominal maksimal Rp100.000.000." }),
  ),
  reason,
});

export const cashAdvanceSchema = z
  .object({
    employeeId: z.uuid({ error: "Pilih karyawan." }),
    amount: rupiah("Isi nominal kasbon dengan angka, contoh 500.000.").pipe(
      z
        .number()
        .min(1, { error: "Isi nominal kasbon lebih dari Rp0." })
        .max(100_000_000, { error: "Nominal maksimal Rp100.000.000." }),
    ),
    installment: rupiah("Isi cicilan dengan angka, contoh 250.000.").pipe(
      z.number().min(1, { error: "Isi cicilan lebih dari Rp0." }),
    ),
    givenOn: z.iso.date({ error: "Pilih tanggal kasbon." }),
    note: z.string().trim().max(200, { error: "Catatan maksimal 200 huruf." }),
  })
  .refine((v) => v.installment <= v.amount, {
    path: ["installment"],
    message: "Cicilan tidak boleh lebih besar dari nominal kasbon.",
  });

export const cancelCashAdvanceSchema = z.object({
  cashAdvanceId: z.uuid({ error: "Kasbon tidak dikenal. Muat ulang halaman." }),
  reason,
});
