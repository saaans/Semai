import Link from "next/link";
import type { Metadata } from "next";
import { CompanyLogo } from "@/components/company-logo";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { getAbsenHome } from "@/lib/attendance/today";
import { requireEmployee } from "@/lib/auth/session";
import { cn } from "@/lib/cn";
import { formatClock, formatDate, timezoneLabel } from "@/lib/format";
import { AbsenCard } from "./_components/absen-card";
import { EmployeeNav } from "./_components/employee-nav";
import { EmployeeShell } from "./_components/employee-shell";
import { InstallPrompt } from "./_components/install-prompt";

export const metadata: Metadata = { title: "Absen" };

export default async function EmployeeAppPage({
  searchParams,
}: {
  searchParams: Promise<{ usaha?: string }>;
}) {
  const { userId, memberships } = await requireEmployee();
  const { usaha } = await searchParams;
  const current = memberships.find((m) => m.companyId === usaha) ?? memberships[0];

  if (!current) {
    return (
      <EmployeeShell header={<EmployeeNav />}>
        <Card>
          <CardTitle>Akunmu sedang nonaktif</CardTitle>
          <CardDescription>
            Kamu belum terdaftar aktif di usaha mana pun. Hubungi pemilik usaha kalau ini keliru.
          </CardDescription>
        </Card>
      </EmployeeShell>
    );
  }

  const home = await getAbsenHome(current.employeeId, current.timezone);
  const tz = timezoneLabel(current.timezone);

  return (
    <EmployeeShell header={<EmployeeNav companyId={current.companyId} />}>
      {memberships.length > 1 && (
        <nav aria-label="Pilih usaha" className="-mx-1 flex gap-2 overflow-x-auto px-1">
          {memberships.map((m) => (
            <Link
              key={m.companyId}
              href={`/app?usaha=${m.companyId}`}
              aria-current={m.companyId === current.companyId ? "page" : undefined}
              className={cn(
                "flex min-h-11 shrink-0 items-center rounded-full border px-4 text-sm",
                m.companyId === current.companyId
                  ? "border-ink bg-ink text-canvas"
                  : "border-stone text-graphite hover:border-graphite",
              )}
            >
              {m.companyName}
            </Link>
          ))}
        </nav>
      )}

      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <CompanyLogo url={current.logoUrl} name={current.companyName} className="size-7 rounded-[7px]" />
          <p className="text-sm text-smoke">
            {current.companyName} · {formatDate(new Date(), current.timezone)}
          </p>
        </div>
        <h1 className="text-3xl">Halo, {current.fullName.split(/\s+/)[0]}</h1>
        {home.schedule && (
          <p className="text-sm text-smoke">
            Jadwal {home.schedule.name}: {formatClock(home.schedule.start_time)}–
            {formatClock(home.schedule.end_time)} {tz}
          </p>
        )}
        {home.remote.active && (
          <p className="text-sm text-smoke">
            Kamu terdaftar kerja remote. Absen bisa dari mana saja.
            {home.remote.graceUntil &&
              ` Berlaku sampai ${formatDate(home.remote.graceUntil, current.timezone)}, setelah itu absen wajib di lokasi usaha.`}
          </p>
        )}
        {home.remote.ended && (
          <p className="text-sm text-danger">
            Absen remote sudah tidak berlaku. Sekarang absen wajib di lokasi usaha. Tanya pemilik
            usaha kalau ini keliru.
          </p>
        )}
      </div>

      <AbsenCard
        key={current.companyId}
        userId={userId}
        companyId={current.companyId}
        timezone={current.timezone}
        mode={home.mode}
        remote={home.remote.active}
        location={home.location}
        today={home.today}
        isWorkDay={home.isWorkDay}
      />

      <InstallPrompt />
    </EmployeeShell>
  );
}
