import Link from "next/link";
import { monthLabel } from "@/lib/attendance/recap";

const arrowClass = "flex min-h-11 min-w-11 items-center justify-center rounded-button text-graphite hover:bg-taupe";

/** Navigasi bulan: ← Oktober 2026 →. Bulan di luar batas paket tidak bisa dibuka. */
export function MonthNav({
  basePath,
  month,
  prevMonth,
  nextMonth,
}: {
  basePath: string;
  month: string;
  prevMonth: string | null;
  nextMonth: string | null;
}) {
  return (
    <div className="flex items-center gap-2">
      {prevMonth ? (
        <Link href={`${basePath}?bulan=${prevMonth}`} className={arrowClass} aria-label="Bulan sebelumnya">
          ←
        </Link>
      ) : (
        <span className="min-w-11" />
      )}
      <p className="min-w-36 text-center font-medium capitalize">{monthLabel(month)}</p>
      {nextMonth ? (
        <Link href={`${basePath}?bulan=${nextMonth}`} className={arrowClass} aria-label="Bulan berikutnya">
          →
        </Link>
      ) : (
        <span className="min-w-11" />
      )}
    </div>
  );
}
