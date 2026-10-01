import Link from "next/link";
import type { Metadata } from "next";
import { monthLabel } from "@/lib/attendance/recap";
import { requireEmployee } from "@/lib/auth/session";
import { formatRupiah } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { EmployeeNav } from "../_components/employee-nav";
import { EmployeeShell } from "../_components/employee-shell";

export const metadata: Metadata = { title: "Slip gaji" };

export default async function SlipListPage({ searchParams }: { searchParams: Promise<{ usaha?: string }> }) {
  const { memberships } = await requireEmployee();
  const { usaha } = await searchParams;
  const current = memberships.find((m) => m.companyId === usaha) ?? memberships[0];

  if (!current) {
    return (
      <EmployeeShell header={<EmployeeNav />}>
        <p className="text-smoke">Akunmu sedang nonaktif di semua usaha.</p>
      </EmployeeShell>
    );
  }

  const supabase = await createClient();
  const { data: slips, error } = await supabase.rpc("list_my_payslips", { p_company_id: current.companyId });
  if (error) {
    console.error("[SlipListPage]", error);
    throw new Error("Gagal memuat slip gaji. Coba muat ulang halaman.");
  }

  return (
    <EmployeeShell header={<EmployeeNav companyId={current.companyId} />}>
      <div className="flex flex-col gap-1">
        <Link href={`/app?usaha=${current.companyId}`} className="text-sm text-smoke underline-offset-4 hover:underline">
          ← Kembali ke absen
        </Link>
        <h1 className="text-3xl">Slip gaji</h1>
        <p className="text-sm text-smoke">{current.companyName}</p>
      </div>

      {slips.length === 0 ? (
        <p className="text-sm text-smoke">Belum ada slip gaji. Slip muncul setelah pemilik usaha mengunci gajian.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-stone border-y border-stone">
          {slips.map((slip) => (
            <li key={slip.id}>
              <Link href={`/app/slip/${slip.id}`} className="flex min-h-14 items-center justify-between gap-3 py-3">
                <span className="font-medium capitalize text-ink">{monthLabel(slip.period_start.slice(0, 7))}</span>
                <span className="font-mono text-ink">{formatRupiah(slip.net_pay)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </EmployeeShell>
  );
}
