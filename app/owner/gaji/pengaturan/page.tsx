import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Tag } from "@/components/ui/tag";
import { requireOwner } from "@/lib/auth/session";
import { formatRupiah } from "@/lib/format";
import { RULE_KINDS } from "@/lib/payroll/calculate";
import { describeRule, KIND_LABEL, toPayrollRule } from "@/lib/payroll/rules";
import { getPayrollCompany } from "@/lib/payroll/server";
import { createClient } from "@/lib/supabase/server";
import { OwnerOnlyCard } from "../_components/owner-only";
import {
  AturanButton,
  GajiHarianForm,
  GajiPokokButton,
  HapusAturanButton,
  type RuleValue,
} from "../_components/pengaturan-forms";

export const metadata: Metadata = { title: "Pengaturan gaji" };

const KIND_HINT: Record<(typeof RULE_KINDS)[number], string> = {
  tunjangan: "Tambahan di luar gaji pokok, misalnya uang makan atau transport.",
  lembur: "Hanya lembur yang sudah kamu setujui yang dibayar.",
  potongan: "Potongan untuk telat, pulang cepat, atau tidak masuk tanpa izin.",
};

export default async function PengaturanGajiPage() {
  const owner = await requireOwner();
  if (!owner.onboardingCompleted) redirect("/owner/onboarding");
  if (owner.role !== "owner") return <OwnerOnlyCard />;

  const supabase = await createClient();
  const [company, employeesRes, rulesRes] = await Promise.all([
    getPayrollCompany(owner.companyId),
    supabase
      .from("employees")
      .select("id, full_name, position, status, base_salary")
      .eq("company_id", owner.companyId)
      .neq("status", "nonaktif")
      .order("full_name"),
    supabase
      .from("payroll_rules")
      .select("id, employee_id, kind, name, calc, amount, trigger_event, is_active")
      .eq("company_id", owner.companyId)
      .order("created_at"),
  ]);
  if (employeesRes.error || rulesRes.error) {
    console.error("[PengaturanGajiPage]", employeesRes.error ?? rulesRes.error);
    throw new Error("Gagal memuat pengaturan gaji. Coba muat ulang halaman.");
  }

  const employees = employeesRes.data;
  const names = new Map(employees.map((e) => [e.id, e.full_name]));
  const pickList = employees.map((e) => ({ id: e.id, name: e.full_name }));
  const rules = rulesRes.data.flatMap((row) => {
    const rule = toPayrollRule(row);
    if (!rule) return [];
    const value: RuleValue = { ...rule, employeeId: row.employee_id, isActive: row.is_active };
    return [value];
  });

  return (
    <>
      <div className="flex flex-col gap-1">
        <Link href="/owner/gaji" className="text-sm text-smoke underline-offset-4 hover:underline">
          ← Kembali ke gajian
        </Link>
        <h1 className="text-3xl sm:text-4xl">Pengaturan gaji</h1>
        <p className="text-smoke">
          Perubahan berlaku untuk gajian yang belum dikunci. Setiap perubahan tercatat di riwayat perubahan.
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-2xl">Gaji pokok</h2>
        {employees.length === 0 ? (
          <p className="text-sm text-smoke">Belum ada karyawan. Tambah karyawan dulu di menu Karyawan.</p>
        ) : (
          <ul className="divide-y divide-stone rounded-card bg-taupe px-4 sm:px-5">
            {employees.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 py-2">
                <div className="flex min-w-0 flex-col">
                  <span className="text-ink">{e.full_name}</span>
                  {e.status === "diundang" && <span className="text-xs text-ash">Belum aktivasi</span>}
                </div>
                <div className="flex items-center gap-1">
                  <span className="font-mono text-sm text-ink">{formatRupiah(e.base_salary)}</span>
                  <GajiPokokButton employeeId={e.id} name={e.full_name} amount={e.base_salary} />
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-ash">
          Karyawan yang mulai atau berhenti di tengah bulan dibayar prorata sesuai hari kerja terjadwal.
        </p>
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-2xl">Komponen gaji</h2>
          <AturanButton employees={pickList} />
        </div>
        {RULE_KINDS.map((kind) => {
          const list = rules.filter((r) => r.kind === kind);
          return (
            <Card key={kind} className="p-4 sm:p-5">
              <CardTitle>{KIND_LABEL[kind]}</CardTitle>
              <CardDescription>{KIND_HINT[kind]}</CardDescription>
              {list.length === 0 ? (
                <p className="mt-3 text-sm text-ash">Belum ada.</p>
              ) : (
                <ul className="mt-3 divide-y divide-stone">
                  {list.map((rule) => (
                    <li key={rule.id} className="flex flex-col gap-1 py-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex min-w-0 flex-col">
                        <span className="flex flex-wrap items-center gap-2 text-ink">
                          {rule.name}
                          {!rule.isActive && <Tag tone="outline">Nonaktif</Tag>}
                          {rule.isActive && rule.amount === 0 && <Tag tone="outline">Nominal Rp0</Tag>}
                        </span>
                        <span className="text-xs text-smoke">
                          {describeRule(rule, formatRupiah(rule.amount ?? 0))}
                          {" · "}
                          {rule.employeeId ? `Hanya ${names.get(rule.employeeId) ?? "karyawan nonaktif"}` : "Semua karyawan"}
                        </span>
                      </div>
                      <div className="flex shrink-0 items-center">
                        <AturanButton rule={rule} employees={pickList} />
                        <HapusAturanButton ruleId={rule.id} name={rule.name} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          );
        })}
      </section>

      <section className="flex max-w-xl flex-col gap-3">
        <h2 className="text-2xl">Gaji harian</h2>
        <p className="text-sm text-smoke">
          Dipakai untuk potongan proporsional: tidak masuk dipotong satu gaji harian per hari, telat dan pulang cepat dipotong
          gaji harian ÷ jam kerja × menit.
        </p>
        <GajiHarianForm dayBasis={company.dayBasis.kind} fixedDays={company.fixedDays} />
      </section>
    </>
  );
}
