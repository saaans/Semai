import "server-only";
import { createClient } from "@/lib/supabase/server";
import { addDays, isWorkDay, localDate } from "./dates";

export type HistoryDay =
  | {
      date: string;
      kind: "hadir";
      clockInAt: string | null;
      clockOutAt: string | null;
      lateMinutes: number;
      earlyLeaveMinutes: number;
      overtimeMinutes: number;
      overtimeStatus: string | null;
      offline: boolean;
      corrected: boolean;
    }
  | { date: string; kind: "tidak_masuk" }
  | { date: string; kind: "lain"; status: string };

export type HistoryMonth = {
  month: string;
  /** Bulan sebelumnya yang boleh dibuka (batas paket + tanggal aktivasi), null = tidak ada. */
  prevMonth: string | null;
  nextMonth: string | null;
  days: HistoryDay[];
  summary: {
    hadir: number;
    telatKali: number;
    telatMenit: number;
    lemburDisetujui: number;
    lemburMenunggu: number;
    tidakMasuk: number;
  };
};

/** "2026-10" ± n bulan. */
function shiftMonth(month: string, delta: number): string {
  const d = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

function lastDayOfMonth(month: string): string {
  return addDays(`${shiftMonth(month, 1)}-01`, -1);
}

export function isMonthParam(value: string | undefined): value is string {
  return Boolean(value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value));
}

/** Riwayat absen satu bulan untuk karyawan yang sedang login (dibatasi RLS). */
export async function getHistoryMonth(
  employeeId: string,
  companyId: string,
  timezone: string,
  requestedMonth: string | undefined,
): Promise<HistoryMonth> {
  const supabase = await createClient();
  const today = localDate(new Date(), timezone);
  const thisMonth = today.slice(0, 7);

  const [{ data: employee, error: employeeError }, { data: limit, error: limitError }] =
    await Promise.all([
      supabase
        .from("employees")
        .select("activated_at, created_at, work_schedules (start_time, end_time, work_days)")
        .eq("id", employeeId)
        .single(),
      supabase.rpc("plan_limit", { p_company_id: companyId, p_limit_key: "riwayat_bulan" }),
    ]);
  if (employeeError || limitError) {
    console.error("[getHistoryMonth]", employeeError ?? limitError);
    throw new Error("Gagal memuat riwayat absen. Coba muat ulang halaman.");
  }

  // Batas paket: riwayat_bulan = jumlah bulan termasuk bulan ini. null = tanpa batas.
  const startDate = localDate(new Date(employee.activated_at ?? employee.created_at), timezone);
  const startMonth = startDate.slice(0, 7);
  const planMonth = limit ? shiftMonth(thisMonth, -(limit - 1)) : startMonth;
  const earliestMonth = planMonth > startMonth ? planMonth : startMonth;

  let month = isMonthParam(requestedMonth) ? requestedMonth : thisMonth;
  if (month > thisMonth) month = thisMonth;
  if (month < earliestMonth) month = earliestMonth;

  const first = `${month}-01`;
  const last = lastDayOfMonth(month);

  const { data: rows, error } = await supabase
    .from("attendances")
    .select(
      "work_date, status, clock_in_at, clock_out_at, late_minutes, early_leave_minutes, overtime_minutes, overtime_status, clock_in_offline, clock_out_offline, corrected_at",
    )
    .eq("employee_id", employeeId)
    .gte("work_date", first)
    .lte("work_date", last)
    .order("work_date", { ascending: false });
  if (error) {
    console.error("[getHistoryMonth] attendances", error);
    throw new Error("Gagal memuat riwayat absen. Coba muat ulang halaman.");
  }

  const byDate = new Map(rows.map((r) => [r.work_date, r]));
  const schedule = employee.work_schedules;
  const days: HistoryDay[] = [];
  const summary = { hadir: 0, telatKali: 0, telatMenit: 0, lemburDisetujui: 0, lemburMenunggu: 0, tidakMasuk: 0 };

  // Dari hari ini (atau akhir bulan) mundur ke awal bulan / tanggal aktivasi.
  const end = last < today ? last : today;
  const begin = first > startDate ? first : startDate;
  for (let date = end; date >= begin; date = addDays(date, -1)) {
    const row = byDate.get(date);
    if (row?.status === "hadir") {
      days.push({
        date,
        kind: "hadir",
        clockInAt: row.clock_in_at,
        clockOutAt: row.clock_out_at,
        lateMinutes: row.late_minutes,
        earlyLeaveMinutes: row.early_leave_minutes,
        overtimeMinutes: row.overtime_minutes,
        overtimeStatus: row.overtime_status,
        offline: row.clock_in_offline || row.clock_out_offline,
        corrected: Boolean(row.corrected_at),
      });
      summary.hadir += 1;
      if (row.late_minutes > 0) {
        summary.telatKali += 1;
        summary.telatMenit += row.late_minutes;
      }
      if (row.overtime_status === "disetujui") summary.lemburDisetujui += row.overtime_minutes;
      if (row.overtime_status === "menunggu") summary.lemburMenunggu += row.overtime_minutes;
    } else if (row) {
      days.push({ date, kind: "lain", status: row.status });
      if (row.status === "alpa") summary.tidakMasuk += 1;
    } else if (date < today && isWorkDay(date, schedule)) {
      // Hari kerja yang sudah lewat tanpa catatan.
      days.push({ date, kind: "tidak_masuk" });
      summary.tidakMasuk += 1;
    }
  }

  return {
    month,
    prevMonth: month > earliestMonth ? shiftMonth(month, -1) : null,
    nextMonth: month < thisMonth ? shiftMonth(month, 1) : null,
    days,
    summary,
  };
}
