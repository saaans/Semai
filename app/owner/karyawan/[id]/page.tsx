import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { formatPhone } from "@/lib/auth/schemas";
import { requireOwner } from "@/lib/auth/session";
import { getEmployeeQuota } from "@/lib/employees/quota";
import { getRemoteStatus } from "@/lib/employees/remote";
import { hasFeature, minLevelLabel } from "@/lib/plans";
import { getCompanyPlan } from "@/lib/plans-server";
import { formatDate, formatRupiah } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { KaryawanActions } from "../_components/karyawan-actions";
import { RemoteToggle } from "../_components/remote-toggle";
import { StatusTag } from "../_components/status-tag";

export const metadata: Metadata = { title: "Detail karyawan" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function DetailKaryawanPage({ params }: { params: Promise<{ id: string }> }) {
  const owner = await requireOwner();
  if (!owner.onboardingCompleted) redirect("/owner/onboarding");

  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const supabase = await createClient();
  const [{ data: employee }, { data: company }, quota, plan, remote] = await Promise.all([
    supabase
      .from("employees")
      .select("id, full_name, phone, position, status, base_salary, activated_at, invite_expires_at, created_at, is_remote")
      .eq("id", id)
      .eq("company_id", owner.companyId)
      .maybeSingle(),
    supabase.from("companies").select("timezone").eq("id", owner.companyId).single(),
    getEmployeeQuota(owner.companyId),
    getCompanyPlan(owner.companyId),
    getRemoteStatus(owner.companyId),
  ]);
  if (!employee) notFound();

  const tz = company?.timezone ?? "Asia/Jakarta";
  const status = employee.status as "diundang" | "aktif" | "nonaktif";

  const rows: [string, React.ReactNode][] = [
    ["Nomor WA", <span key="p" className="font-mono">{formatPhone(employee.phone)}</span>],
    ["Jabatan", employee.position ?? "–"],
    ["Gaji pokok", <span key="g" className="font-mono">{formatRupiah(employee.base_salary)}</span>],
    ["Ditambahkan", formatDate(employee.created_at, tz)],
    [
      status === "diundang" ? "Link berlaku sampai" : "Aktivasi",
      status === "diundang"
        ? employee.invite_expires_at
          ? formatDate(employee.invite_expires_at, tz)
          : "–"
        : employee.activated_at
          ? formatDate(employee.activated_at, tz)
          : "–",
    ],
  ];

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <Link href="/owner/karyawan" className="-ml-2 inline-flex min-h-11 items-center self-start rounded-button px-2 text-sm text-graphite hover:bg-taupe">
        ← Karyawan
      </Link>
      <div className="flex flex-col gap-3">
        <StatusTag status={employee.status} />
        <h1 className="text-3xl sm:text-4xl">{employee.full_name}</h1>
      </div>
      <Card>
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-sm">
          {rows.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-smoke">{label}</dt>
              <dd className="text-right text-ink">{value}</dd>
            </div>
          ))}
        </dl>
      </Card>
      {status === "diundang" && (
        <p className="text-sm text-smoke">
          Belum aktivasi. Link undangan hanya tampil sekali saat dibuat; kalau karyawan kehilangan
          link, buat link baru.
        </p>
      )}
      {status !== "nonaktif" && (
        <RemoteToggle
          employeeId={employee.id}
          isRemote={employee.is_remote}
          unlocked={hasFeature(plan, "absen_remote")}
          planLabel={minLevelLabel(plan, "absen_remote") ?? "Dasar"}
          graceNote={
            !employee.is_remote
              ? null
              : remote.graceUntil
                ? `Paket usaha sudah turun ke Benih. Absen remote masih berlaku sampai ${formatDate(remote.graceUntil, tz)}, setelah itu kembali wajib dalam radius lokasi.`
                : !remote.allowed
                  ? "Absen remote tidak berlaku karena paket usaha Benih. Karyawan ini sekarang wajib absen dalam radius lokasi."
                  : null
          }
        />
      )}
      <KaryawanActions
        employeeId={employee.id}
        status={status}
        plan={{ name: quota.planName, limit: quota.limit }}
      />
    </div>
  );
}
