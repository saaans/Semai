import Link from "next/link";
import type { Metadata } from "next";
import { Card } from "@/components/ui/card";
import { Tag } from "@/components/ui/tag";
import { getHistoryMonth, type HistoryDay } from "@/lib/attendance/history";
import { dayLabel, monthLabel } from "@/lib/attendance/recap";
import { requireEmployee } from "@/lib/auth/session";
import { formatMinutes, formatTime } from "@/lib/format";
import { EmployeeNav } from "../_components/employee-nav";
import { EmployeeShell } from "../_components/employee-shell";

export const metadata: Metadata = { title: "Riwayat absen" };

const STATUS_LABEL: Record<string, string> = {
  izin: "Izin",
  sakit: "Sakit",
  alpa: "Tidak masuk",
  libur: "Libur",
};

export default async function RiwayatPage({
  searchParams,
}: {
  searchParams: Promise<{ usaha?: string; bulan?: string }>;
}) {
  const { memberships } = await requireEmployee();
  const { usaha, bulan } = await searchParams;
  const current = memberships.find((m) => m.companyId === usaha) ?? memberships[0];

  if (!current) {
    return (
      <EmployeeShell header={<EmployeeNav />}>
        <p className="text-smoke">Akunmu sedang nonaktif di semua usaha.</p>
      </EmployeeShell>
    );
  }

  const history = await getHistoryMonth(
    current.employeeId,
    current.companyId,
    current.timezone,
    bulan,
  );
  const base = `/app/riwayat?usaha=${current.companyId}`;
  const { summary } = history;

  return (
    <EmployeeShell header={<EmployeeNav companyId={current.companyId} />}>
      <div className="flex flex-col gap-1">
        <Link href={`/app?usaha=${current.companyId}`} className="text-sm text-smoke underline-offset-4 hover:underline">
          ← Kembali ke absen
        </Link>
        <h1 className="text-3xl">Riwayat absen</h1>
        <p className="text-sm text-smoke">{current.companyName}</p>
      </div>

      <div className="flex items-center justify-between gap-2">
        {history.prevMonth ? (
          <Link href={`${base}&bulan=${history.prevMonth}`} className="flex min-h-11 items-center px-2 text-sm text-graphite" aria-label="Bulan sebelumnya">
            ←
          </Link>
        ) : (
          <span className="min-h-11 w-8" />
        )}
        <p className="font-medium capitalize">{monthLabel(history.month)}</p>
        {history.nextMonth ? (
          <Link href={`${base}&bulan=${history.nextMonth}`} className="flex min-h-11 items-center px-2 text-sm text-graphite" aria-label="Bulan berikutnya">
            →
          </Link>
        ) : (
          <span className="min-h-11 w-8" />
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Summary label="Hadir" value={`${summary.hadir} hari`} />
        <Summary label="Tidak masuk" value={`${summary.tidakMasuk} hari`} />
        <Summary
          label="Telat"
          value={`${summary.telatKali} kali`}
          hint={summary.telatMenit > 0 ? `Total ${formatMinutes(summary.telatMenit)}` : undefined}
        />
        <Summary
          label="Lembur disetujui"
          value={summary.lemburDisetujui > 0 ? formatMinutes(summary.lemburDisetujui) : "0"}
          hint={summary.lemburMenunggu > 0 ? `${formatMinutes(summary.lemburMenunggu)} menunggu owner` : undefined}
        />
      </div>

      {history.days.length === 0 ? (
        <p className="text-sm text-smoke">Belum ada catatan absen di bulan ini.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-stone border-y border-stone">
          {history.days.map((day) => (
            <DayRow key={day.date} day={day} timezone={current.timezone} />
          ))}
        </ul>
      )}
    </EmployeeShell>
  );
}

function Summary({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="p-4 sm:p-4">
      <p className="text-sm text-smoke">{label}</p>
      <p className="mt-1 font-display text-2xl">{value}</p>
      {hint && <p className="mt-1 text-xs text-ash">{hint}</p>}
    </Card>
  );
}

function DayRow({ day, timezone }: { day: HistoryDay; timezone: string }) {
  const notes: string[] = [];
  if (day.kind === "hadir") {
    if (day.lateMinutes > 0) notes.push(`Telat ${formatMinutes(day.lateMinutes)}`);
    if (day.earlyLeaveMinutes > 0) notes.push(`Pulang cepat ${formatMinutes(day.earlyLeaveMinutes)}`);
    if (day.overtimeMinutes > 0) {
      const status =
        day.overtimeStatus === "disetujui"
          ? "disetujui"
          : day.overtimeStatus === "ditolak"
            ? "tidak disetujui"
            : "menunggu owner";
      notes.push(`Lembur ${formatMinutes(day.overtimeMinutes)} (${status})`);
    }
    if (day.offline) notes.push("Dikirim saat offline");
  }
  const correctionReason = day.kind === "tidak_masuk" ? null : day.correctionReason;

  return (
    <li className="flex items-start justify-between gap-3 py-3">
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium text-ink">{dayLabel(day.date)}</span>
        {day.kind === "hadir" && (
          <span className="font-mono text-sm text-graphite">
            {day.clockInAt ? formatTime(day.clockInAt, timezone) : "–"}
            {" → "}
            {day.clockOutAt ? formatTime(day.clockOutAt, timezone) : "–"}
          </span>
        )}
        {notes.length > 0 && <span className="text-xs text-smoke">{notes.join(" · ")}</span>}
        {correctionReason && (
          <span className="text-xs text-smoke">Dikoreksi owner: {correctionReason}</span>
        )}
      </div>
      {day.kind === "hadir" && (
        <Tag tone={day.lateMinutes > 0 ? "outline" : "neutral"}>
          {day.lateMinutes > 0 ? "Telat" : "Hadir"}
        </Tag>
      )}
      {day.kind === "tidak_masuk" && <Tag tone="ink">Tidak masuk</Tag>}
      {day.kind === "lain" && <Tag tone="outline">{STATUS_LABEL[day.status] ?? day.status}</Tag>}
    </li>
  );
}
