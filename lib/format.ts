/** 1250000 → "Rp1.250.000". Uang selalu integer rupiah. */
export function formatRupiah(amount: number): string {
  return `Rp${Math.round(amount).toLocaleString("id-ID")}`;
}

/** Tanggal "30 Sep 2026" di zona waktu usaha. */
export function formatDate(value: string | Date, timeZone = "Asia/Jakarta"): string {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone,
  }).format(new Date(value));
}

const TIMEZONE_LABELS: Record<string, string> = {
  "Asia/Jakarta": "WIB",
  "Asia/Makassar": "WITA",
  "Asia/Jayapura": "WIT",
};

/** "Asia/Makassar" → "WITA". */
export function timezoneLabel(timeZone: string): string {
  return TIMEZONE_LABELS[timeZone] ?? "WIB";
}

/** Jam "07.58" di zona waktu usaha. */
export function formatTime(value: string | Date, timeZone = "Asia/Jakarta"): string {
  return new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone,
  }).format(new Date(value));
}

/** Jam dari kolom time Postgres: "08:00:00" → "08.00". */
export function formatClock(time: string): string {
  return time.slice(0, 5).replace(":", ".");
}

/** 75 → "1 jam 15 menit", 40 → "40 menit". */
export function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} menit`;
  return rest === 0 ? `${hours} jam` : `${hours} jam ${rest} menit`;
}
