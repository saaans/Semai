/**
 * Hitung hari dan ringkasan absen satu periode. Fungsi murni, dipakai
 * riwayat karyawan (/app/riwayat) dan rekap owner (/owner/absen) supaya
 * angkanya selalu sama.
 */
import { addDays, isWorkDay, type ScheduleLite } from "./dates";

export type RecapRow = {
  work_date: string;
  status: string;
  late_minutes: number;
  overtime_minutes: number;
  overtime_status: string | null;
};

export type RecapDay<R extends RecapRow> =
  | { date: string; kind: "tercatat"; row: R }
  | { date: string; kind: "tidak_masuk" };

export type RecapSummary = {
  hadir: number;
  telatKali: number;
  telatMenit: number;
  /** Izin + sakit. */
  izin: number;
  /** Alpa + hari kerja yang sudah lewat tanpa catatan. */
  tidakMasuk: number;
  lemburDisetujui: number;
  lemburMenunggu: number;
};

export function emptySummary(): RecapSummary {
  return { hadir: 0, telatKali: 0, telatMenit: 0, izin: 0, tidakMasuk: 0, lemburDisetujui: 0, lemburMenunggu: 0 };
}

/**
 * Hari dari `end` mundur ke `begin` (YYYY-MM-DD). Hari kerja yang sudah
 * lewat (sebelum `today`) tanpa catatan dihitung tidak masuk.
 */
export function buildRecap<R extends RecapRow>(
  rows: R[],
  { begin, end, today, schedule }: { begin: string; end: string; today: string; schedule: ScheduleLite | null },
): { days: RecapDay<R>[]; summary: RecapSummary } {
  const byDate = new Map(rows.map((r) => [r.work_date, r]));
  const days: RecapDay<R>[] = [];
  const summary = emptySummary();

  for (let date = end; date >= begin; date = addDays(date, -1)) {
    const row = byDate.get(date);
    if (row) {
      days.push({ date, kind: "tercatat", row });
      if (row.status === "hadir") {
        summary.hadir += 1;
        if (row.late_minutes > 0) {
          summary.telatKali += 1;
          summary.telatMenit += row.late_minutes;
        }
        if (row.overtime_status === "disetujui") summary.lemburDisetujui += row.overtime_minutes;
        if (row.overtime_status === "menunggu") summary.lemburMenunggu += row.overtime_minutes;
      } else if (row.status === "izin" || row.status === "sakit") {
        summary.izin += 1;
      } else if (row.status === "alpa") {
        summary.tidakMasuk += 1;
      }
    } else if (date < today && isWorkDay(date, schedule)) {
      days.push({ date, kind: "tidak_masuk" });
      summary.tidakMasuk += 1;
    }
  }

  return { days, summary };
}

/** "2026-10" ± n bulan. */
export function shiftMonth(month: string, delta: number): string {
  const d = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

export function lastDayOfMonth(month: string): string {
  return addDays(`${shiftMonth(month, 1)}-01`, -1);
}

export function isMonthParam(value: string | undefined): value is string {
  return Boolean(value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value));
}

/**
 * Bulan yang boleh dibuka: dari bulan mulai (aktivasi / usaha dibuat) dan
 * batas paket riwayat_bulan (jumlah bulan termasuk bulan ini, null = tanpa
 * batas) sampai bulan ini.
 */
export function resolveMonth(
  requested: string | undefined,
  { thisMonth, startMonth, limitMonths }: { thisMonth: string; startMonth: string; limitMonths: number | null },
) {
  const planMonth = limitMonths ? shiftMonth(thisMonth, -(limitMonths - 1)) : startMonth;
  const earliest = planMonth > startMonth ? planMonth : startMonth;

  let month = isMonthParam(requested) ? requested : thisMonth;
  if (month > thisMonth) month = thisMonth;
  if (month < earliest) month = earliest;

  return {
    month,
    first: `${month}-01`,
    last: lastDayOfMonth(month),
    prevMonth: month > earliest ? shiftMonth(month, -1) : null,
    nextMonth: month < thisMonth ? shiftMonth(month, 1) : null,
  };
}

/** "2026-10" → "Oktober 2026". */
export function monthLabel(month: string) {
  return new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${month}-01T00:00:00Z`),
  );
}

/** "2026-10-01" → "Kam, 1 Okt". */
export function dayLabel(date: string) {
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}
