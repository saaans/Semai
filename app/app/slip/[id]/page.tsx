import Link from "next/link";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PayslipLines } from "@/components/payslip-lines";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { monthLabel } from "@/lib/attendance/recap";
import { getSessionUser, isEmployeeEmail } from "@/lib/auth/session";
import { formatDate } from "@/lib/format";
import { getPayslipView } from "@/lib/payroll/slip";
import { EmployeeNav } from "../../_components/employee-nav";
import { EmployeeShell } from "../../_components/employee-shell";

export const metadata: Metadata = { title: "Slip gaji" };

/** Slip gaji karyawan. Link ini yang dikirim owner lewat WA. */
export default async function SlipPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user || !isEmployeeEmail(user.email)) redirect(`/app/masuk?next=/app/slip/${encodeURIComponent(id)}`);

  const slip = await getPayslipView(id);
  if (!slip) notFound();

  const month = slip.periodStart.slice(0, 7);
  return (
    <EmployeeShell header={<EmployeeNav />}>
      <div className="flex flex-col gap-1">
        <Link href="/app/slip" className="text-sm text-smoke underline-offset-4 hover:underline">
          ← Semua slip gaji
        </Link>
        <h1 className="text-3xl capitalize">{monthLabel(month)}</h1>
        <p className="text-sm text-smoke">
          {slip.company.name} · dikunci {formatDate(slip.lockedAt, slip.company.timezone)}
        </p>
      </div>

      {slip.attendance.length > 0 && (
        <dl className="grid grid-cols-3 gap-3">
          {slip.attendance.map((fact) => (
            <div key={fact.label} className="rounded-card bg-taupe p-3">
              <dt className="text-xs text-smoke">{fact.label}</dt>
              <dd className="mt-0.5 text-sm text-ink">{fact.value}</dd>
            </div>
          ))}
        </dl>
      )}

      <Card>
        <PayslipLines lines={slip.lines} netPay={slip.netPay} />
      </Card>

      <a href={`/app/slip/${slip.id}/pdf`} className={buttonClasses({ fullWidth: true })}>
        <span className="flex-1 pl-0.5 text-left">Unduh slip PDF</span>
      </a>
      <p className="text-xs text-ash">Ada yang tidak sesuai? Tanyakan ke pemilik usaha. Koreksi dicatat di gajian berikutnya.</p>
    </EmployeeShell>
  );
}
