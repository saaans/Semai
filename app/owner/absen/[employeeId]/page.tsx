import Link from "next/link";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Tag } from "@/components/ui/tag";
import { getEmployeeMonth } from "@/lib/attendance/owner";
import { dayLabel, lastDayOfMonth } from "@/lib/attendance/recap";
import { requireOwner } from "@/lib/auth/session";
import { formatMinutes } from "@/lib/format";
import { AbsenInfo, AbsenStatusTag, koreksiInitial } from "../../_components/absen-info";
import { KoreksiButton } from "../../_components/koreksi-button";
import { LemburActions } from "../../_components/lembur-actions";
import { MonthNav } from "../../_components/month-nav";

export const metadata: Metadata = { title: "Absen karyawan" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function AbsenKaryawanPage({
  params,
  searchParams,
}: {
  params: Promise<{ employeeId: string }>;
  searchParams: Promise<{ bulan?: string }>;
}) {
  const owner = await requireOwner();
  if (!owner.onboardingCompleted) redirect("/owner/onboarding");

  const [{ employeeId }, { bulan }] = await Promise.all([params, searchParams]);
  if (!UUID.test(employeeId)) notFound();

  const data = await getEmployeeMonth(owner.companyId, employeeId, bulan);
  if (!data) notFound();

  const { employee, summary, timezone } = data;
  const showClockOut = data.attendanceMode === "masuk_pulang";
  const monthEnd = lastDayOfMonth(data.month);
  const lastDate = data.today < monthEnd ? data.today : monthEnd;

  const cards = [
    { label: "Hadir", value: `${summary.hadir} hari` },
    { label: "Tidak masuk", value: `${summary.tidakMasuk} hari`, hint: summary.izin > 0 ? `${summary.izin} hari izin/sakit` : undefined },
    { label: "Telat", value: `${summary.telatKali} kali`, hint: summary.telatMenit > 0 ? `Total ${formatMinutes(summary.telatMenit)}` : undefined },
    {
      label: "Lembur disetujui",
      value: summary.lemburDisetujui > 0 ? formatMinutes(summary.lemburDisetujui) : "0",
      hint: summary.lemburMenunggu > 0 ? `${formatMinutes(summary.lemburMenunggu)} menunggu` : undefined,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <Link href={`/owner/absen?bulan=${data.month}`} className="-ml-2 inline-flex min-h-11 items-center self-start rounded-button px-2 text-sm text-graphite hover:bg-taupe">
        ← Rekap absen
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-2">
          {(!employee.active || employee.isRemote) && (
            <div className="flex gap-2">
              {!employee.active && <Tag tone="outline">Nonaktif</Tag>}
              {employee.isRemote && <Tag tone="outline">Remote</Tag>}
            </div>
          )}
          <h1 className="text-3xl sm:text-4xl">{employee.name}</h1>
          {employee.position && <p className="text-smoke">{employee.position}</p>}
        </div>
        <MonthNav basePath={`/owner/absen/${employee.id}`} month={data.month} prevMonth={data.prevMonth} nextMonth={data.nextMonth} />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.label} className="p-4 sm:p-5">
            <p className="text-sm text-smoke">{card.label}</p>
            <p className="mt-1 font-display text-2xl">{card.value}</p>
            {card.hint && <p className="mt-1 text-xs text-ash">{card.hint}</p>}
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl">Per hari</h2>
        <KoreksiButton
          employeeId={employee.id}
          employeeName={employee.name}
          minDate={`${data.month}-01`}
          maxDate={lastDate}
          showClockOut={showClockOut}
          label="Catat tanggal lain"
          variant="button"
        />
      </div>

      {data.days.length === 0 ? (
        <p className="text-sm text-smoke">Belum ada catatan absen di bulan ini.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-stone border-y border-stone">
          {data.days.map((day) => {
            const attendance = day.kind === "tercatat" ? day.attendance : null;
            return (
              <li key={day.date} className="flex flex-col gap-3 py-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium text-ink">{dayLabel(day.date)}</span>
                  <AbsenStatusTag attendance={attendance} />
                </div>
                {attendance && <AbsenInfo attendance={attendance} timezone={timezone} name={employee.name} remote={employee.isRemote} />}
                <div className="-my-1 flex flex-wrap items-center justify-end gap-2">
                  {attendance?.overtimeStatus === "menunggu" && <LemburActions attendanceId={attendance.id} />}
                  <KoreksiButton
                    employeeId={employee.id}
                    employeeName={employee.name}
                    workDate={day.date}
                    dateLabel={dayLabel(day.date)}
                    initial={koreksiInitial(attendance, timezone)}
                    showClockOut={showClockOut || Boolean(attendance?.clockOutAt)}
                    label={attendance ? "Koreksi" : "Catat manual"}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
