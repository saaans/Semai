import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PayslipLines } from "@/components/payslip-lines";
import { Card } from "@/components/ui/card";
import { Tag } from "@/components/ui/tag";
import { localDate } from "@/lib/attendance/dates";
import { monthLabel } from "@/lib/attendance/recap";
import { getSiteUrl } from "@/lib/auth/site-url";
import { requireOwner } from "@/lib/auth/session";
import { formatDate, formatMinutes, formatRupiah } from "@/lib/format";
import { monthPeriod } from "@/lib/payroll/attendance";
import {
  buildPayrollPreview,
  getLockedRun,
  getPayrollCompany,
  listLockedRuns,
  resolvePayrollMonth,
  type LockedRun,
  type PayrollPreview,
} from "@/lib/payroll/server";
import { createClient } from "@/lib/supabase/server";
import { MonthNav } from "../_components/month-nav";
import { KirimWaButton } from "./_components/kirim-wa";
import { KunciGajianButton } from "./_components/kunci-gajian";
import { OwnerOnlyCard } from "./_components/owner-only";
import { HapusPenyesuaianButton, PenyesuaianButton } from "./_components/penyesuaian";

export const metadata: Metadata = { title: "Gajian" };

const subLink = "inline-flex min-h-11 items-center rounded-button border border-stone px-4 text-sm text-ink hover:border-graphite hover:bg-taupe";

export default async function GajiPage({ searchParams }: { searchParams: Promise<{ bulan?: string }> }) {
  const owner = await requireOwner();
  if (!owner.onboardingCompleted) redirect("/owner/onboarding");
  if (owner.role !== "owner") return <OwnerOnlyCard />;

  const { bulan } = await searchParams;
  const company = await getPayrollCompany(owner.companyId);
  const today = localDate(new Date(), company.timezone);
  const history = await listLockedRuns(owner.companyId);
  const nav = resolvePayrollMonth(bulan, {
    today,
    createdAt: company.createdAt,
    timezone: company.timezone,
    lockedMonths: new Set(history.map((h) => h.month)),
  });
  const label = monthLabel(nav.month);
  const locked = await getLockedRun(owner.companyId, monthPeriod(nav.month).start);

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl sm:text-4xl">Gajian</h1>
          <p className="text-smoke">Periksa gaji setiap karyawan, lalu kunci untuk membuat slip gaji.</p>
        </div>
        <MonthNav basePath="/owner/gaji" month={nav.month} prevMonth={nav.prevMonth} nextMonth={nav.nextMonth} />
      </div>
      <div className="flex flex-wrap gap-2">
        <Link href="/owner/gaji/pengaturan" className={subLink}>
          Pengaturan gaji
        </Link>
        <Link href="/owner/kasbon" className={subLink}>
          Kasbon
        </Link>
      </div>

      {locked ? (
        <LockedView run={locked} monthLabel={label} companyId={owner.companyId} timezone={company.timezone} />
      ) : (
        <PreviewView
          preview={await buildPayrollPreview(owner.companyId, company, nav.month, today)}
          month={nav.month}
          monthLabel={label}
        />
      )}

      {history.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-2xl">Riwayat gajian</h2>
          <ul className="divide-y divide-stone border-y border-stone">
            {history.map((run) => (
              <li key={run.id}>
                <Link href={`/owner/gaji?bulan=${run.month}`} className="flex min-h-11 items-center justify-between gap-3 py-3 hover:bg-taupe">
                  <span className="capitalize">{monthLabel(run.month)}</span>
                  <span className="text-sm text-smoke">
                    {run.employeeCount} karyawan · <span className="font-mono text-ink">{formatRupiah(run.totalNet)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function Totals({ items }: { items: { label: string; value: string; hint?: string }[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
      {items.map((item, i) => (
        // Kartu pertama (total dibayar) selebar layar di HP.
        <Card key={item.label} className={i === 0 ? "col-span-2 p-4 sm:p-5 lg:col-span-1" : "p-4 sm:p-5"}>
          <p className="text-sm text-smoke">{item.label}</p>
          <p className="mt-1 font-mono text-xl text-ink sm:text-2xl">{item.value}</p>
          {item.hint && <p className="mt-1 text-xs text-ash">{item.hint}</p>}
        </Card>
      ))}
    </div>
  );
}

function PreviewView({ preview, month, monthLabel: label }: { preview: PayrollPreview; month: string; monthLabel: string }) {
  const warnings: string[] = [];
  if (preview.monthOngoing) {
    warnings.push(
      `${label} belum selesai. Hari tidak masuk setelah hari ini belum terhitung, dan absen bulan ini tidak bisa dikoreksi setelah dikunci.`,
    );
  }
  if (preview.pendingOvertime > 0) {
    warnings.push(`${preview.pendingOvertime} lembur masih menunggu persetujuan dan belum masuk gajian. Setujui dulu di dashboard kalau ingin dibayar.`);
  }
  const negative = preview.employees.filter((e) => e.result.negative);

  if (preview.employees.length === 0) {
    return <p className="text-sm text-smoke">Belum ada karyawan aktif di {label}.</p>;
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Tag tone="outline">Pratinjau</Tag>
        <span className="text-sm text-smoke">Angka dihitung dari absen terbaru setiap kali halaman dibuka.</span>
      </div>

      <Totals
        items={[
          { label: "Total dibayar", value: formatRupiah(preview.totals.net) },
          { label: "Karyawan", value: `${preview.employees.length}` },
          { label: "Potongan", value: formatRupiah(preview.totals.deductions), hint: "Termasuk cicilan kasbon" },
        ]}
      />

      {warnings.length > 0 && (
        <Card className="flex flex-col gap-2 border border-stone bg-canvas">
          {warnings.map((w) => (
            <p key={w} className="text-sm text-graphite">
              {w}
            </p>
          ))}
        </Card>
      )}

      <ul className="flex flex-col gap-3">
        {preview.employees.map((e) => {
          const a = e.attendance;
          const facts = [
            `${a.hadir} hadir`,
            a.telatKali > 0 ? `telat ${a.telatKali}× (${formatMinutes(a.telatMenit)})` : null,
            a.pulangCepatKali > 0 ? `pulang cepat ${a.pulangCepatKali}×` : null,
            a.alpa > 0 ? `${a.alpa} tidak masuk` : null,
            a.izin > 0 ? `${a.izin} izin/sakit` : null,
            a.lemburMenit > 0 ? `lembur ${formatMinutes(a.lemburMenit)}` : null,
          ].filter(Boolean);
          return (
            <li key={e.employeeId}>
              <Card className="p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-col">
                    <span className="font-medium text-ink">
                      {e.name}
                      {!e.active && <span className="ml-2 text-xs font-normal text-ash">Nonaktif</span>}
                    </span>
                    <span className="text-xs text-smoke">{facts.join(" · ")}</span>
                  </div>
                  <span className="shrink-0 font-mono text-lg text-ink">{formatRupiah(e.result.netPay)}</span>
                </div>
                {e.result.negative && (
                  <p className="mt-2 text-sm text-danger">Penyesuaian minus lebih besar dari gaji. Hapus atau kecilkan penyesuaiannya.</p>
                )}
                <details className="group mt-2">
                  <summary className="flex min-h-11 cursor-pointer items-center text-sm text-graphite underline underline-offset-4">
                    Lihat rincian
                  </summary>
                  <div className="mt-2 rounded-button bg-canvas p-4">
                    <PayslipLines lines={e.result.lines} netPay={e.result.netPay} />
                  </div>
                </details>
                {e.adjustments.length > 0 && (
                  <ul className="mt-2 flex flex-col gap-1">
                    {e.adjustments.map((adj) => (
                      <li key={adj.id} className="flex items-center justify-between gap-2 text-xs text-smoke">
                        <span className="min-w-0">
                          Penyesuaian {adj.amount > 0 ? "+" : "−"}
                          {formatRupiah(Math.abs(adj.amount))}: {adj.reason}
                        </span>
                        <HapusPenyesuaianButton adjustmentId={adj.id} />
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <PenyesuaianButton employeeId={e.employeeId} employeeName={e.name} month={month} />
                </div>
              </Card>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        {negative.length === 0 ? (
          <KunciGajianButton
            month={month}
            monthLabel={label}
            expectedNet={preview.totals.net}
            summary={`${preview.employees.length} karyawan, total dibayar ${formatRupiah(preview.totals.net)}.`}
            warnings={warnings}
          />
        ) : (
          <p className="text-sm text-danger">Perbaiki penyesuaian yang lebih besar dari gaji sebelum mengunci.</p>
        )}
      </div>
    </>
  );
}

async function LockedView({
  run,
  monthLabel: label,
  companyId,
  timezone,
}: {
  run: LockedRun;
  monthLabel: string;
  companyId: string;
  timezone: string;
}) {
  const supabase = await createClient();
  const [site, { data: company }] = await Promise.all([
    getSiteUrl(),
    supabase.from("companies").select("name").eq("id", companyId).maybeSingle(),
  ]);
  const companyName = company?.name ?? "kami";

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Tag tone="ink">Dikunci</Tag>
        <span className="text-sm text-smoke">
          {formatDate(run.lockedAt, timezone)}. Perubahan dicatat sebagai penyesuaian di gajian berikutnya.
        </span>
      </div>

      <Totals
        items={[
          { label: "Total dibayar", value: formatRupiah(run.totalNet) },
          { label: "Karyawan", value: `${run.payslips.length}` },
          { label: "Potongan", value: formatRupiah(run.totalDeductions), hint: "Termasuk cicilan kasbon" },
        ]}
      />

      <ul className="flex flex-col gap-3">
        {run.payslips.map((slip) => {
          const message = `Halo ${slip.name}, slip gaji ${label} dari ${companyName} sudah bisa dilihat di sini: ${site}/app/slip/${slip.id}`;
          const waHref = slip.phone
            ? `https://wa.me/${slip.phone}?text=${encodeURIComponent(message)}`
            : `https://wa.me/?text=${encodeURIComponent(message)}`;
          return (
            <li key={slip.id}>
              <Card className="p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-col">
                    <span className="font-medium text-ink">{slip.name}</span>
                    {slip.position && <span className="text-xs text-smoke">{slip.position}</span>}
                  </div>
                  <span className="shrink-0 font-mono text-lg text-ink">{formatRupiah(slip.netPay)}</span>
                </div>
                <details className="mt-2">
                  <summary className="flex min-h-11 cursor-pointer items-center text-sm text-graphite underline underline-offset-4">
                    Lihat rincian
                  </summary>
                  <div className="mt-2 rounded-button bg-canvas p-4">
                    <PayslipLines lines={slip.lines} netPay={slip.netPay} />
                  </div>
                </details>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <a
                    href={`/owner/gaji/slip/${slip.id}`}
                    className="inline-flex min-h-11 items-center rounded-button border border-stone px-4 text-sm text-ink hover:border-graphite hover:bg-taupe"
                  >
                    Unduh slip
                  </a>
                  <KirimWaButton
                    payslipId={slip.id}
                    href={waHref}
                    sentLabel={slip.waSentAt ? `Terkirim ${formatDate(slip.waSentAt, timezone)}` : null}
                  />
                </div>
              </Card>
            </li>
          );
        })}
      </ul>
    </>
  );
}
