import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireOwner } from "@/lib/auth/session";
import { getEmployeeQuota } from "@/lib/employees/quota";
import { TambahForm } from "../_components/tambah-form";
import { UpgradeCard } from "../_components/upgrade-card";

export const metadata: Metadata = { title: "Tambah karyawan" };

export default async function TambahKaryawanPage() {
  const owner = await requireOwner();
  if (!owner.onboardingCompleted) redirect("/owner/onboarding");
  const quota = await getEmployeeQuota(owner.companyId);

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <Link href="/owner/karyawan" className="-ml-2 inline-flex min-h-11 items-center self-start rounded-button px-2 text-sm text-graphite hover:bg-taupe">
        ← Karyawan
      </Link>
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl sm:text-4xl">Tambah karyawan</h1>
        <p className="text-smoke">
          Setelah disimpan, kirim link undangan lewat WA. Karyawan aktivasi dan membuat PIN dari HP
          sendiri.
        </p>
      </div>
      {quota.full ? (
        <UpgradeCard planName={quota.planName} limit={quota.limit} />
      ) : (
        <TambahForm planName={quota.planName} limit={quota.limit} />
      )}
    </div>
  );
}
