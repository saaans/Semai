import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { formatPhone } from "@/lib/auth/schemas";
import { requireOwner } from "@/lib/auth/session";
import { getBillingOverview } from "@/lib/billing/server";
import { quotaStatus } from "@/lib/billing/state";
import { createClient } from "@/lib/supabase/server";
import { QuotaNotice } from "../_components/quota-notice";
import { StatusTag } from "./_components/status-tag";

export const metadata: Metadata = { title: "Karyawan" };

const STATUS_ORDER: Record<string, number> = { aktif: 0, diundang: 1, nonaktif: 2 };

export default async function KaryawanPage() {
  const owner = await requireOwner();
  if (!owner.onboardingCompleted) redirect("/owner/onboarding");

  const supabase = await createClient();
  const [{ data: employees, error }, overview, { data: company }] = await Promise.all([
    supabase
      .from("employees")
      .select("id, full_name, phone, position, status")
      .eq("company_id", owner.companyId)
      .order("full_name"),
    getBillingOverview(owner.companyId),
    supabase.from("companies").select("timezone").eq("id", owner.companyId).maybeSingle(),
  ]);
  if (error) throw new Error("Gagal memuat daftar karyawan. Coba muat ulang halaman.");

  const quota = quotaStatus(overview.employeesUsed, overview.employeeLimit);
  const full = quota !== null && quota.remaining === 0;

  const sorted = [...employees].sort(
    (a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9),
  );

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl sm:text-4xl">Karyawan</h1>
          <p className="text-smoke">
            <span className="font-mono text-ink">{overview.employeesUsed}</span>
            {overview.employeeLimit !== null && (
              <>
                {" "}dari <span className="font-mono">{overview.employeeLimit}</span>
              </>
            )}{" "}
            karyawan terpakai · paket {overview.planName}
          </p>
        </div>
        {!full && <ButtonLink href="/owner/karyawan/tambah">Tambah karyawan</ButtonLink>}
      </div>

      <QuotaNotice overview={overview} timezone={company?.timezone ?? "Asia/Jakarta"} />

      {sorted.length === 0 ? (
        <Card>
          <CardTitle>Belum ada karyawan</CardTitle>
          <CardDescription>
            Tambahkan karyawan, lalu kirim link undangan lewat WA. Mereka aktivasi dari HP sendiri
            dan membuat PIN untuk absen.
          </CardDescription>
        </Card>
      ) : (
        <ul className="flex flex-col divide-y divide-stone overflow-hidden rounded-card bg-taupe">
          {sorted.map((employee) => (
            <li key={employee.id}>
              <Link
                href={`/owner/karyawan/${employee.id}`}
                className="flex min-h-16 items-center justify-between gap-3 px-5 py-3 hover:bg-stone/50"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-ink">{employee.full_name}</p>
                  <p className="truncate text-sm text-smoke">
                    {employee.position ? `${employee.position} · ` : ""}
                    <span className="font-mono">{formatPhone(employee.phone)}</span>
                  </p>
                </div>
                <StatusTag status={employee.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
