import "server-only";
import { createClient } from "@/lib/supabase/server";
import { localDate } from "./dates";
import { buildRecap, resolveMonth, type RecapSummary } from "./recap";

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
      correctionReason: string | null;
    }
  | { date: string; kind: "tidak_masuk" }
  | { date: string; kind: "lain"; status: string; correctionReason: string | null };

export type HistoryMonth = {
  month: string;
  /** Bulan sebelumnya yang boleh dibuka (batas paket + tanggal aktivasi), null = tidak ada. */
  prevMonth: string | null;
  nextMonth: string | null;
  days: HistoryDay[];
  summary: RecapSummary;
  /** Jumlah hari di bulan ini yang fotonya sudah dihapus sesuai masa simpan paket. */
  photosDeletedDays: number;
};

/** Riwayat absen satu bulan untuk karyawan yang sedang login (dibatasi RLS). */
export async function getHistoryMonth(
  employeeId: string,
  companyId: string,
  timezone: string,
  requestedMonth: string | undefined,
): Promise<HistoryMonth> {
  const supabase = await createClient();
  const today = localDate(new Date(), timezone);

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

  const startDate = localDate(new Date(employee.activated_at ?? employee.created_at), timezone);
  const { month, first, last, prevMonth, nextMonth } = resolveMonth(requestedMonth, {
    thisMonth: today.slice(0, 7),
    startMonth: startDate.slice(0, 7),
    limitMonths: limit,
  });

  const { data: rows, error } = await supabase
    .from("attendances")
    .select(
      "work_date, status, clock_in_at, clock_out_at, late_minutes, early_leave_minutes, overtime_minutes, overtime_status, clock_in_offline, clock_out_offline, corrected_at, correction_reason, photos_deleted_at",
    )
    .eq("employee_id", employeeId)
    .gte("work_date", first)
    .lte("work_date", last)
    .order("work_date", { ascending: false });
  if (error) {
    console.error("[getHistoryMonth] attendances", error);
    throw new Error("Gagal memuat riwayat absen. Coba muat ulang halaman.");
  }

  // Dari hari ini (atau akhir bulan) mundur ke awal bulan / tanggal aktivasi.
  const recap = buildRecap(rows, {
    begin: first > startDate ? first : startDate,
    end: last < today ? last : today,
    today,
    schedule: employee.work_schedules,
  });

  const days: HistoryDay[] = recap.days.map((day) => {
    if (day.kind === "tidak_masuk") return day;
    const row = day.row;
    if (row.status !== "hadir") {
      return { date: day.date, kind: "lain", status: row.status, correctionReason: row.correction_reason };
    }
    return {
      date: day.date,
      kind: "hadir",
      clockInAt: row.clock_in_at,
      clockOutAt: row.clock_out_at,
      lateMinutes: row.late_minutes,
      earlyLeaveMinutes: row.early_leave_minutes,
      overtimeMinutes: row.overtime_minutes,
      overtimeStatus: row.overtime_status,
      offline: row.clock_in_offline || row.clock_out_offline,
      corrected: Boolean(row.corrected_at),
      correctionReason: row.correction_reason,
    };
  });

  const photosDeletedDays = rows.filter((r) => r.photos_deleted_at).length;

  return { month, prevMonth, nextMonth, days, summary: recap.summary, photosDeletedDays };
}
