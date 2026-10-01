/**
 * Ringkasan absen dan hari kerja untuk gajian. Fungsi murni di atas
 * buildRecap supaya angka telat/tidak masuk sama dengan rekap owner.
 */
import { addDays, isWorkDay, type ScheduleLite } from "@/lib/attendance/dates";
import { buildRecap, lastDayOfMonth, type RecapRow } from "@/lib/attendance/recap";
import { DEFAULT_DAILY_MINUTES, type AttendanceTotals } from "./calculate";

export type PayrollAttendanceRow = RecapRow & { early_leave_minutes: number };

/** Periode gajian = bulan kalender. "2026-10" → 1–31 Okt. */
export function monthPeriod(month: string) {
  return { start: `${month}-01`, end: lastDayOfMonth(month) };
}

/** Jumlah hari kerja terjadwal dari `begin` sampai `end` (inklusif). */
export function countWorkDays(begin: string, end: string, schedule: ScheduleLite | null): number {
  let count = 0;
  for (let date = begin; date <= end; date = addDays(date, 1)) {
    if (isWorkDay(date, schedule)) count += 1;
  }
  return count;
}

/** Durasi kerja per hari dari jadwal, dalam menit. Shift lewat tengah malam ikut dihitung. */
export function scheduleMinutes(schedule: ScheduleLite | null): number {
  if (!schedule) return DEFAULT_DAILY_MINUTES;
  const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  let diff = toMin(schedule.end_time) - toMin(schedule.start_time);
  if (diff <= 0) diff += 24 * 60;
  return diff;
}

/**
 * Rentang kerja karyawan di periode ini.
 * - employed: untuk prorata gaji pokok (mulai kerja s/d nonaktif).
 * - counted: untuk menghitung absen (sejak aktivasi, s/d nonaktif). Hari
 *   setelah `today` belum dihitung tidak masuk.
 */
export function employmentRange({
  start,
  end,
  joinedOn,
  activatedOn,
  deactivatedOn,
}: {
  start: string;
  end: string;
  /** Tanggal mulai kerja (employees.joined_on), kalau diisi owner. */
  joinedOn: string | null;
  /** Tanggal aktivasi akun di zona usaha. */
  activatedOn: string;
  deactivatedOn: string | null;
}) {
  const max = (a: string, b: string) => (a > b ? a : b);
  const min = (a: string, b: string) => (a < b ? a : b);
  const stop = deactivatedOn ? min(end, deactivatedOn) : end;
  const employedFrom = max(start, joinedOn ?? activatedOn);
  const countedFrom = max(employedFrom, activatedOn);
  return {
    employed: { begin: employedFrom, end: stop },
    counted: { begin: countedFrom, end: stop },
  };
}

/** Ringkasan absen satu karyawan untuk gajian. Hanya lembur disetujui yang dihitung. */
export function attendanceTotals(
  rows: PayrollAttendanceRow[],
  { begin, end, today, schedule }: { begin: string; end: string; today: string; schedule: ScheduleLite | null },
): AttendanceTotals {
  const totals: AttendanceTotals = {
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
  if (begin > end) return totals;

  const { days, summary } = buildRecap(rows, { begin, end, today, schedule });
  totals.hadir = summary.hadir;
  totals.telatKali = summary.telatKali;
  totals.telatMenit = summary.telatMenit;
  totals.alpa = summary.tidakMasuk;
  totals.izin = summary.izin;
  totals.lemburMenit = summary.lemburDisetujui;

  for (const day of days) {
    if (day.kind !== "tercatat" || day.row.status !== "hadir") continue;
    if (day.row.early_leave_minutes > 0) {
      totals.pulangCepatKali += 1;
      totals.pulangCepatMenit += day.row.early_leave_minutes;
    }
    if (day.row.overtime_status === "disetujui" && day.row.overtime_minutes > 0) totals.lemburHari += 1;
  }
  return totals;
}
