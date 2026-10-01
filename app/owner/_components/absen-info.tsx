import { Tag } from "@/components/ui/tag";
import type { OwnerAttendance } from "@/lib/attendance/owner";
import { localClock } from "@/lib/attendance/dates";
import { formatMinutes, formatTime } from "@/lib/format";
import { AbsenPhoto } from "./absen-photo";
import type { KoreksiInitial } from "./koreksi-button";

export const STATUS_LABEL: Record<string, string> = {
  hadir: "Hadir",
  izin: "Izin",
  sakit: "Sakit",
  alpa: "Tidak masuk",
  libur: "Libur",
};

/** Nilai awal form koreksi dari absen yang ada. */
export function koreksiInitial(attendance: OwnerAttendance | null, timezone: string): KoreksiInitial | undefined {
  if (!attendance) return undefined;
  return {
    status: attendance.status,
    clockIn: attendance.clockInAt ? localClock(new Date(attendance.clockInAt), timezone) : "",
    clockOut: attendance.clockOutAt ? localClock(new Date(attendance.clockOutAt), timezone) : "",
  };
}

/** 240 → "240 m", 44478 → "44,5 km". */
export function formatDistance(meters: number) {
  if (meters < 1000) return `${meters} m`;
  return `${(meters / 1000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} km`;
}

function overtimeText(attendance: OwnerAttendance) {
  const status =
    attendance.overtimeStatus === "disetujui"
      ? "disetujui"
      : attendance.overtimeStatus === "ditolak"
        ? "ditolak"
        : "menunggu persetujuan";
  return `Lembur ${formatMinutes(attendance.overtimeMinutes)} (${status})`;
}

/** Jam, jarak, foto, dan catatan satu absen. */
export function AbsenInfo({
  attendance,
  timezone,
  name,
  radiusM,
  remote,
}: {
  attendance: OwnerAttendance;
  timezone: string;
  name: string;
  radiusM?: number | null;
  /** Karyawan remote: jarak hanya info, bukan batas. */
  remote?: boolean;
}) {
  if (attendance.status !== "hadir") {
    return attendance.correctionReason ? (
      <p className="text-xs text-smoke">Dikoreksi: {attendance.correctionReason}</p>
    ) : null;
  }

  const notes: string[] = [];
  if (attendance.lateMinutes > 0) notes.push(`Telat ${formatMinutes(attendance.lateMinutes)}`);
  if (attendance.earlyLeaveMinutes > 0) notes.push(`Pulang cepat ${formatMinutes(attendance.earlyLeaveMinutes)}`);
  if (attendance.overtimeMinutes > 0) notes.push(overtimeText(attendance));
  if (attendance.offline) notes.push("Dikirim saat offline");

  const distance = (meters: number | null, at: string | null) => {
    if (!at) return null;
    if (remote) return meters === null ? "Absen remote" : `Absen remote · ${formatDistance(meters)} dari lokasi`;
    return meters === null ? null : `${formatDistance(meters)}${radiusM ? ` dari lokasi (radius ${radiusM} m)` : " dari lokasi"}`;
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start gap-3">
        {attendance.photosDeleted ? (
          <span className="text-xs text-ash">Foto sudah dihapus sesuai masa simpan paket.</span>
        ) : (
          <>
            {attendance.clockInAt && (
              <AbsenPhoto url={attendance.clockInPhotoUrl} alt={`Foto masuk ${name}`} label="Masuk" />
            )}
            {attendance.clockOutAt && (
              <AbsenPhoto url={attendance.clockOutPhotoUrl} alt={`Foto pulang ${name}`} label="Pulang" />
            )}
          </>
        )}
        <dl className="grid min-w-0 grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-sm">
          <dt className="text-smoke">Masuk</dt>
          <dd className="min-w-0">
            <span className="font-mono text-ink">{attendance.clockInAt ? formatTime(attendance.clockInAt, timezone) : "–"}</span>
            {distance(attendance.clockInDistanceM, attendance.clockInAt) && (
              <span className="block truncate text-xs text-smoke">{distance(attendance.clockInDistanceM, attendance.clockInAt)}</span>
            )}
          </dd>
          <dt className="text-smoke">Pulang</dt>
          <dd className="min-w-0">
            <span className="font-mono text-ink">{attendance.clockOutAt ? formatTime(attendance.clockOutAt, timezone) : "–"}</span>
            {distance(attendance.clockOutDistanceM, attendance.clockOutAt) && (
              <span className="block truncate text-xs text-smoke">{distance(attendance.clockOutDistanceM, attendance.clockOutAt)}</span>
            )}
          </dd>
        </dl>
      </div>
      {notes.length > 0 && <p className="text-xs text-smoke">{notes.join(" · ")}</p>}
      {attendance.correctionReason && (
        <p className="text-xs text-smoke">Dikoreksi: {attendance.correctionReason}</p>
      )}
    </div>
  );
}

/** Tag status satu hari absen. */
export function AbsenStatusTag({ attendance }: { attendance: OwnerAttendance | null }) {
  if (!attendance) return <Tag tone="ink">Tidak masuk</Tag>;
  if (attendance.status === "hadir") {
    return attendance.lateMinutes > 0 ? <Tag tone="accent">Telat</Tag> : <Tag>Hadir</Tag>;
  }
  if (attendance.status === "alpa") return <Tag tone="ink">Tidak masuk</Tag>;
  return <Tag tone="outline">{STATUS_LABEL[attendance.status] ?? attendance.status}</Tag>;
}
