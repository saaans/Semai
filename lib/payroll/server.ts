import "server-only";
import { localDate, type ScheduleLite } from "@/lib/attendance/dates";
import { isMonthParam, shiftMonth } from "@/lib/attendance/recap";
import { createClient } from "@/lib/supabase/server";
import {
  attendanceTotals,
  countWorkDays,
  employmentRange,
  monthPeriod,
  scheduleMinutes,
  type PayrollAttendanceRow,
} from "./attendance";
import { calculatePayslip, type AttendanceTotals, type DayBasis, type PayrollRule, type PayslipLine, type PayslipResult } from "./calculate";
import { toPayrollRule } from "./rules";

function fail(where: string, error: unknown): never {
  console.error(`[${where}]`, error);
  throw new Error("Gagal memuat data gajian. Coba muat ulang halaman.");
}

export type PayrollCompany = {
  timezone: string;
  createdAt: string;
  dayBasis: DayBasis;
  fixedDays: number;
};

export async function getPayrollCompany(companyId: string): Promise<PayrollCompany> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("companies")
    .select("timezone, created_at, payroll_day_basis, payroll_fixed_days")
    .eq("id", companyId)
    .single();
  if (error) fail("getPayrollCompany", error);
  return {
    timezone: data.timezone,
    createdAt: data.created_at,
    fixedDays: data.payroll_fixed_days,
    dayBasis: data.payroll_day_basis === "tetap" ? { kind: "tetap", days: data.payroll_fixed_days } : { kind: "jadwal" },
  };
}

// -----------------------------------------------------------------------------
// Bulan
// -----------------------------------------------------------------------------

export type PayrollMonthNav = {
  month: string;
  thisMonth: string;
  prevMonth: string | null;
  nextMonth: string | null;
};

/**
 * Bulan gajian yang dibuka. Tanpa ?bulan: bulan lalu kalau belum dikunci
 * (owner biasanya menggaji setelah bulan selesai), selain itu bulan ini.
 */
export function resolvePayrollMonth(
  requested: string | undefined,
  { today, createdAt, timezone, lockedMonths }: { today: string; createdAt: string; timezone: string; lockedMonths: Set<string> },
): PayrollMonthNav {
  const thisMonth = today.slice(0, 7);
  const earliest = localDate(new Date(createdAt), timezone).slice(0, 7);
  let month: string;
  if (isMonthParam(requested)) {
    month = requested > thisMonth ? thisMonth : requested < earliest ? earliest : requested;
  } else {
    const last = shiftMonth(thisMonth, -1);
    month = last >= earliest && !lockedMonths.has(last) ? last : thisMonth;
  }
  return {
    month,
    thisMonth,
    prevMonth: month > earliest ? shiftMonth(month, -1) : null,
    nextMonth: month < thisMonth ? shiftMonth(month, 1) : null,
  };
}

// -----------------------------------------------------------------------------
// Pratinjau
// -----------------------------------------------------------------------------

export type PreviewEmployee = {
  employeeId: string;
  name: string;
  position: string | null;
  active: boolean;
  attendance: AttendanceTotals;
  monthWorkDays: number;
  employedWorkDays: number;
  adjustments: { id: string; amount: number; reason: string }[];
  result: PayslipResult;
};

export type PayrollPreview = {
  period: { start: string; end: string };
  /** Bulan belum selesai: absen setelah hari ini belum terhitung. */
  monthOngoing: boolean;
  pendingOvertime: number;
  employees: PreviewEmployee[];
  totals: { gross: number; deductions: number; net: number };
};

type EmployeeRow = {
  id: string;
  full_name: string;
  position: string | null;
  status: string;
  base_salary: number;
  joined_on: string | null;
  activated_at: string | null;
  deactivated_at: string | null;
  created_at: string;
  work_schedules: ScheduleLite | null;
};

async function fetchAttendances(companyId: string, from: string, to: string) {
  const supabase = await createClient();
  const pageSize = 1000;
  const rows: (PayrollAttendanceRow & { employee_id: string })[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from("attendances")
      .select("employee_id, work_date, status, late_minutes, early_leave_minutes, overtime_minutes, overtime_status")
      .eq("company_id", companyId)
      .gte("work_date", from)
      .lte("work_date", to)
      .order("work_date")
      .order("id")
      .range(offset, offset + pageSize - 1);
    if (error) fail("fetchAttendances", error);
    rows.push(...data);
    if (data.length < pageSize) return rows;
  }
}

/** Hitung gaji semua karyawan satu bulan dari data terbaru (belum dikunci). */
export async function buildPayrollPreview(
  companyId: string,
  company: PayrollCompany,
  month: string,
  today: string,
): Promise<PayrollPreview> {
  const supabase = await createClient();
  const period = monthPeriod(month);

  const [employeesRes, rulesRes, advancesRes, adjustmentsRes, rows] = await Promise.all([
    supabase
      .from("employees")
      .select(
        "id, full_name, position, status, base_salary, joined_on, activated_at, deactivated_at, created_at, work_schedules (start_time, end_time, work_days)",
      )
      .eq("company_id", companyId)
      .neq("status", "diundang")
      .order("full_name"),
    supabase
      .from("payroll_rules")
      .select("id, employee_id, kind, name, calc, amount, trigger_event, is_active")
      .eq("company_id", companyId)
      .eq("is_active", true)
      .order("created_at"),
    supabase
      .from("cash_advances")
      .select("id, employee_id, balance, installment_amount, given_on")
      .eq("company_id", companyId)
      .eq("status", "aktif")
      .lte("given_on", period.end)
      .order("given_on")
      .order("created_at"),
    supabase
      .from("payroll_adjustments")
      .select("id, employee_id, amount, reason")
      .eq("company_id", companyId)
      .eq("period_start", period.start)
      .order("created_at"),
    fetchAttendances(companyId, period.start, period.end),
  ]);
  if (employeesRes.error) fail("preview employees", employeesRes.error);
  if (rulesRes.error) fail("preview rules", rulesRes.error);
  if (advancesRes.error) fail("preview advances", advancesRes.error);
  if (adjustmentsRes.error) fail("preview adjustments", adjustmentsRes.error);

  const rules = rulesRes.data
    .map((r) => ({ rule: toPayrollRule(r), employeeId: r.employee_id }))
    .filter((r): r is { rule: PayrollRule; employeeId: string | null } => r.rule !== null);

  const rowsByEmployee = new Map<string, PayrollAttendanceRow[]>();
  let pendingOvertime = 0;
  for (const row of rows) {
    const list = rowsByEmployee.get(row.employee_id) ?? [];
    list.push(row);
    rowsByEmployee.set(row.employee_id, list);
    if (row.status === "hadir" && row.overtime_status === "menunggu" && row.overtime_minutes > 0) pendingOvertime += 1;
  }

  const employees: PreviewEmployee[] = [];
  const totals = { gross: 0, deductions: 0, net: 0 };
  const tz = company.timezone;

  for (const employee of employeesRes.data as EmployeeRow[]) {
    const range = employmentRange({
      start: period.start,
      end: period.end,
      joinedOn: employee.joined_on,
      activatedOn: localDate(new Date(employee.activated_at ?? employee.created_at), tz),
      deactivatedOn: employee.deactivated_at ? localDate(new Date(employee.deactivated_at), tz) : null,
    });
    const adjustments = adjustmentsRes.data.filter((a) => a.employee_id === employee.id);
    // Belum mulai atau sudah keluar sebelum bulan ini, dan tidak punya penyesuaian: lewati.
    if (range.employed.begin > range.employed.end && adjustments.length === 0) continue;

    const schedule = employee.work_schedules;
    const monthWorkDays = countWorkDays(period.start, period.end, schedule);
    const employedWorkDays = countWorkDays(range.employed.begin, range.employed.end, schedule);
    const attendance = attendanceTotals(rowsByEmployee.get(employee.id) ?? [], {
      begin: range.counted.begin,
      end: range.counted.end,
      today,
      schedule,
    });

    const result = calculatePayslip({
      baseSalary: employee.base_salary,
      monthWorkDays,
      employedWorkDays,
      dailyMinutes: scheduleMinutes(schedule),
      dayBasis: company.dayBasis,
      rules: rules.filter((r) => r.employeeId === null || r.employeeId === employee.id).map((r) => r.rule),
      attendance,
      cashAdvances: advancesRes.data
        .filter((a) => a.employee_id === employee.id)
        .map((a) => ({ id: a.id, balance: a.balance, installment: a.installment_amount })),
      adjustments: adjustments.map((a) => ({ id: a.id, amount: a.amount, reason: a.reason })),
    });

    totals.gross += result.baseSalary + result.totalAllowances + result.totalOvertime + Math.max(result.adjustment, 0);
    totals.deductions += result.totalDeductions + result.cashAdvanceDeduction + Math.max(-result.adjustment, 0);
    totals.net += result.netPay;

    employees.push({
      employeeId: employee.id,
      name: employee.full_name,
      position: employee.position,
      active: employee.status === "aktif",
      attendance,
      monthWorkDays,
      employedWorkDays,
      adjustments,
      result,
    });
  }

  return { period, monthOngoing: today <= period.end, pendingOvertime, employees, totals };
}

/** Payload RPC lock_payroll_run dari hasil pratinjau. */
export function lockPayload(preview: PayrollPreview) {
  return preview.employees.map((e) => ({
    employee_id: e.employeeId,
    base_salary: e.result.baseSalary,
    total_allowances: e.result.totalAllowances,
    total_overtime: e.result.totalOvertime,
    total_deductions: e.result.totalDeductions,
    cash_advance_deduction: e.result.cashAdvanceDeduction,
    adjustment: e.result.adjustment,
    net_pay: e.result.netPay,
    lines: e.result.lines,
    attendance_summary: { ...e.attendance, hariKerjaBulan: e.monthWorkDays, hariKerjaDibayar: e.employedWorkDays },
    cash_advances: e.result.cashAdvanceDeductions,
  }));
}

// -----------------------------------------------------------------------------
// Gajian terkunci
// -----------------------------------------------------------------------------

export type LockedPayslip = {
  id: string;
  employeeId: string;
  name: string;
  position: string | null;
  phone: string | null;
  baseSalary: number;
  totalAllowances: number;
  totalOvertime: number;
  totalDeductions: number;
  cashAdvanceDeduction: number;
  adjustment: number;
  netPay: number;
  lines: PayslipLine[];
  waSentAt: string | null;
};

export type LockedRun = {
  id: string;
  periodStart: string;
  periodEnd: string;
  lockedAt: string;
  totalGross: number;
  totalDeductions: number;
  totalNet: number;
  payslips: LockedPayslip[];
};

export function parseLines(value: unknown): PayslipLine[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (l): l is PayslipLine =>
      typeof l === "object" && l !== null && typeof l.label === "string" && typeof l.amount === "number",
  );
}

export async function getLockedRun(companyId: string, periodStart: string): Promise<LockedRun | null> {
  const supabase = await createClient();
  const { data: run, error } = await supabase
    .from("payroll_runs")
    .select("id, period_start, period_end, locked_at, total_gross, total_deductions, total_net")
    .eq("company_id", companyId)
    .eq("period_start", periodStart)
    .eq("status", "dikunci")
    .maybeSingle();
  if (error) fail("getLockedRun", error);
  if (!run) return null;

  const { data: slips, error: slipsError } = await supabase
    .from("payslips")
    .select(
      "id, employee_id, employee_name, employee_position, base_salary, total_allowances, total_overtime, total_deductions, cash_advance_deduction, adjustment, net_pay, lines, wa_sent_at, employees (full_name, phone)",
    )
    .eq("payroll_run_id", run.id)
    .order("employee_name");
  if (slipsError) fail("getLockedRun payslips", slipsError);

  return {
    id: run.id,
    periodStart: run.period_start,
    periodEnd: run.period_end,
    lockedAt: run.locked_at ?? run.period_end,
    totalGross: run.total_gross,
    totalDeductions: run.total_deductions,
    totalNet: run.total_net,
    payslips: slips.map((s) => ({
      id: s.id,
      employeeId: s.employee_id,
      name: s.employee_name ?? s.employees?.full_name ?? "Karyawan",
      position: s.employee_position,
      phone: s.employees?.phone ?? null,
      baseSalary: s.base_salary,
      totalAllowances: s.total_allowances,
      totalOvertime: s.total_overtime,
      totalDeductions: s.total_deductions,
      cashAdvanceDeduction: s.cash_advance_deduction,
      adjustment: s.adjustment,
      netPay: s.net_pay,
      lines: parseLines(s.lines),
      waSentAt: s.wa_sent_at,
    })),
  };
}

/** Bulan yang sudah dikunci, terbaru dulu. */
export async function listLockedRuns(companyId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payroll_runs")
    .select("id, period_start, employee_count, total_net, locked_at")
    .eq("company_id", companyId)
    .eq("status", "dikunci")
    .order("period_start", { ascending: false })
    .limit(24);
  if (error) fail("listLockedRuns", error);
  return data.map((r) => ({
    id: r.id,
    month: r.period_start.slice(0, 7),
    employeeCount: r.employee_count,
    totalNet: r.total_net,
    lockedAt: r.locked_at,
  }));
}
