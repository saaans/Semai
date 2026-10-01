/**
 * Tanggal dan hari kerja di zona waktu usaha. Dipakai server dan browser;
 * aturan resminya tetap di RPC clock_in (hanya untuk tampilan).
 */

/** Tanggal lokal "YYYY-MM-DD" di zona usaha. */
export function localDate(value: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone,
  }).format(value);
}

/** Jam lokal "HH:MM" di zona usaha. */
export function localClock(value: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone,
  }).format(value);
}

/** "2026-10-01" + n hari. */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** 1 = Senin ... 7 = Minggu (ISO), sama dengan work_schedules.work_days. */
export function isoWeekday(date: string): number {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return day === 0 ? 7 : day;
}

export type ScheduleLite = {
  start_time: string;
  end_time: string;
  work_days: number[];
};

/**
 * Tanggal kerja saat ini, sama dengan RPC: shift lewat tengah malam yang
 * belum selesai masih dihitung hari kemarin.
 */
export function currentWorkDate(now: Date, timeZone: string, schedule: ScheduleLite | null): string {
  const today = localDate(now, timeZone);
  if (!schedule) return today;
  const start = schedule.start_time.slice(0, 5);
  const end = schedule.end_time.slice(0, 5);
  if (end < start && localClock(now, timeZone) < end) return addDays(today, -1);
  return today;
}

export function isWorkDay(date: string, schedule: ScheduleLite | null): boolean {
  return !schedule || schedule.work_days.includes(isoWeekday(date));
}
