import { cn } from "@/lib/cn";

export type Kehadiran = {
  /** Masuk tepat waktu (tanpa yang telat). */
  tepat: number;
  telat: number;
  izin: number;
  /** Libur atau tidak masuk. */
  lainnya: number;
  belum: number;
};

const SEGMENTS: { key: keyof Kehadiran; label: string; swatch: string }[] = [
  { key: "tepat", label: "Tepat waktu", swatch: "bg-ink" },
  { key: "telat", label: "Telat", swatch: "bg-accent" },
  { key: "izin", label: "Izin", swatch: "bg-smoke" },
  { key: "lainnya", label: "Libur / tidak masuk", swatch: "bg-ash" },
  { key: "belum", label: "Belum absen", swatch: "bg-stone" },
];

/**
 * Bar proporsi kehadiran hari ini. Bar hanya hiasan untuk mata; angkanya
 * selalu tertulis di legenda supaya terbaca pembaca layar.
 */
export function KehadiranBar({
  data,
  animate = false,
  legend = "inline",
  className,
}: {
  data: Kehadiran;
  /** Isi bar bergerak dari kiri saat pertama tampil (landing). */
  animate?: boolean;
  /** inline = satu baris kecil, grid = kolom angka sejajar, false = tanpa legenda. */
  legend?: "inline" | "grid" | false;
  className?: string;
}) {
  const total = SEGMENTS.reduce((sum, s) => sum + data[s.key], 0);
  if (total === 0) return null;

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div aria-hidden className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full">
        {SEGMENTS.map((s) =>
          data[s.key] > 0 ? (
            <span
              key={s.key}
              className={cn("h-full first:rounded-l-full last:rounded-r-full", s.swatch, animate && "bar-isi")}
              style={{ flexGrow: data[s.key], flexBasis: 0 }}
            />
          ) : null,
        )}
      </div>
      {legend === "grid" && (
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
          {SEGMENTS.filter((s) => data[s.key] > 0 || s.key !== "lainnya").map((s) => (
            <div key={s.key} className="flex flex-col gap-1">
              <dt className="flex items-center gap-1.5 text-sm text-smoke">
                <span aria-hidden className={cn("size-2.5 rounded-full", s.swatch, s.key === "belum" && "ring-1 ring-ash ring-inset")} />
                {s.label}
              </dt>
              <dd className="font-display text-3xl font-light tracking-tight tabular-nums">{data[s.key]}</dd>
            </div>
          ))}
        </dl>
      )}
      {legend === "inline" && (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-smoke">
          {SEGMENTS.filter((s) => data[s.key] > 0 || s.key !== "lainnya").map((s) => (
            <li key={s.key} className="flex items-center gap-1.5">
              <span aria-hidden className={cn("size-2.5 rounded-full", s.swatch, s.key === "belum" && "ring-1 ring-ash ring-inset")} />
              {s.label}
              <span className="font-medium text-ink tabular-nums">{data[s.key]}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
