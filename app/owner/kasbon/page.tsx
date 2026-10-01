import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Tag } from "@/components/ui/tag";
import { localDate } from "@/lib/attendance/dates";
import { requireOwner } from "@/lib/auth/session";
import { formatDate, formatRupiah } from "@/lib/format";
import { hasFeature } from "@/lib/plans";
import { getCompanyPlan } from "@/lib/plans-server";
import { getPayrollCompany } from "@/lib/payroll/server";
import { createClient } from "@/lib/supabase/server";
import { OwnerOnlyCard } from "../gaji/_components/owner-only";
import { BatalKasbonButton, KasbonButton } from "./kasbon-forms";

export const metadata: Metadata = { title: "Kasbon" };

const STATUS_LABEL: Record<string, string> = { lunas: "Lunas", dibatalkan: "Dibatalkan" };

export default async function KasbonPage() {
  const owner = await requireOwner();
  if (!owner.onboardingCompleted) redirect("/owner/onboarding");

  const plan = await getCompanyPlan(owner.companyId);
  const supabase = await createClient();
  const { count } = await supabase
    .from("cash_advances")
    .select("id", { count: "exact", head: true })
    .eq("company_id", owner.companyId)
    .eq("status", "aktif");
  // Di luar paket dan tidak ada kasbon berjalan: halaman fitur terkunci.
  // Kasbon lama yang masih berjalan tetap terlihat (dan tetap dipotong).
  const unlocked = hasFeature(plan, "kasbon");
  if (!unlocked && !count) redirect("/owner/fitur/kasbon");
  if (owner.role !== "owner") return <OwnerOnlyCard />;

  const [company, employeesRes, advancesRes] = await Promise.all([
    getPayrollCompany(owner.companyId),
    supabase.from("employees").select("id, full_name").eq("company_id", owner.companyId).eq("status", "aktif").order("full_name"),
    supabase
      .from("cash_advances")
      .select("id, employee_id, amount, installment_amount, balance, status, given_on, note, employees (full_name)")
      .eq("company_id", owner.companyId)
      .order("given_on", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(200),
  ]);
  if (employeesRes.error || advancesRes.error) {
    console.error("[KasbonPage]", employeesRes.error ?? advancesRes.error);
    throw new Error("Gagal memuat kasbon. Coba muat ulang halaman.");
  }

  const today = localDate(new Date(), company.timezone);
  const active = advancesRes.data.filter((a) => a.status === "aktif");
  const done = advancesRes.data.filter((a) => a.status !== "aktif");
  const totalBalance = active.reduce((sum, a) => sum + a.balance, 0);

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <Link href="/owner/gaji" className="text-sm text-smoke underline-offset-4 hover:underline">
            ← Kembali ke gajian
          </Link>
          <h1 className="text-3xl sm:text-4xl">Kasbon</h1>
          <p className="text-smoke">Cicilan dipotong otomatis setiap gajian dikunci.</p>
        </div>
        {unlocked && employeesRes.data.length > 0 && (
          <KasbonButton employees={employeesRes.data.map((e) => ({ id: e.id, name: e.full_name }))} today={today} />
        )}
      </div>

      <Card className="p-4 sm:p-5">
        <p className="text-sm text-smoke">Sisa kasbon berjalan</p>
        <p className="mt-1 font-mono text-2xl text-ink">{formatRupiah(totalBalance)}</p>
        <p className="mt-1 text-xs text-ash">{active.length} kasbon</p>
      </Card>

      {active.length === 0 ? (
        <p className="text-sm text-smoke">Belum ada kasbon berjalan.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {active.map((a) => {
            const name = a.employees?.full_name ?? "Karyawan";
            return (
              <li key={a.id}>
                <Card className="p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-col">
                      <span className="font-medium text-ink">{name}</span>
                      <span className="text-xs text-smoke">
                        {formatDate(`${a.given_on}T00:00:00Z`, "UTC")} · {formatRupiah(a.amount)} · cicilan {formatRupiah(a.installment_amount)}
                      </span>
                      {a.note && <span className="text-xs text-smoke">{a.note}</span>}
                    </div>
                    <div className="flex shrink-0 flex-col items-end">
                      <span className="font-mono text-ink">{formatRupiah(a.balance)}</span>
                      <span className="text-xs text-ash">sisa</span>
                    </div>
                  </div>
                  <div className="mt-1">
                    <BatalKasbonButton cashAdvanceId={a.id} name={name} />
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {done.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-2xl">Selesai</h2>
          <ul className="divide-y divide-stone border-y border-stone">
            {done.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 py-3">
                <div className="flex min-w-0 flex-col">
                  <span className="text-ink">{a.employees?.full_name ?? "Karyawan"}</span>
                  <span className="text-xs text-smoke">
                    {formatDate(`${a.given_on}T00:00:00Z`, "UTC")} · {formatRupiah(a.amount)}
                  </span>
                </div>
                <Tag tone="outline">{STATUS_LABEL[a.status] ?? a.status}</Tag>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
