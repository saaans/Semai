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
import { hasFeature, minLevelLabel } from "@/lib/plans";
import { getCompanyPlan } from "@/lib/plans-server";
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
import { RincianToggle } from "./_components/rincian-toggle";

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

      <Card className="p-0 sm:p-0">
        <ul className="flex flex-col divide-y divide-stone">
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
              <li key={e.employeeId} className="flex flex-col gap-1 px-4 py-4 sm:px-6">
                <GajiRowHead name={e.name} sub={facts.join(" · ")} inactive={!e.active} netPay={e.result.netPay} />
                <div className="pl-[3.25rem]">
                  {e.result.negative && (
                    <p className="mt-1 text-sm text-danger">Penyesuaian minus lebih besar dari gaji. Hapus atau kecilkan penyesuaiannya.</p>
                  )}
                  {e.adjustments.length > 0 && (
                    <ul className="mt-1 flex flex-col">
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
                  <RincianToggle actions={<PenyesuaianButton employeeId={e.employeeId} employeeName={e.name} month={month} />}>
                    <PayslipLines lines={e.result.lines} netPay={e.result.netPay} />
                  </RincianToggle>
                </div>
              </li>
            );
          })}
        </ul>
      </Card>

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
  const [site, { data: company }, plan] = await Promise.all([
    getSiteUrl(),
    supabase.from("companies").select("name").eq("id", companyId).maybeSingle(),
    getCompanyPlan(companyId),
  ]);
  const companyName = company?.name ?? "kami";
  // Kirim otomatis (Plus) tampil terkunci di sebelah kirim manual.
  const waAutoLabel = hasFeature(plan, "wa_auto") ? null : minLevelLabel(plan, "wa_auto");

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Tag tone="ink">Dikunci</Tag>
        <span className="text-sm text-smoke">
          {formatDate(run.lockedAt, timezone)}. Perubahan dicatat sebagai penyesuaian di gajian berikutnya.
        </span>
      </div>

      {waAutoLabel && (
        <div>
          <Link
            href="/owner/fitur/wa_auto"
            className="inline-flex min-h-11 items-center gap-1.5 text-sm text-graphite underline underline-offset-4 hover:text-ink"
          >
            <LockIcon />
            Kirim slip otomatis ke semua · {waAutoLabel}
          </Link>
        </div>
      )}

      <Totals
        items={[
          { label: "Total dibayar", value: formatRupiah(run.totalNet) },
          { label: "Karyawan", value: `${run.payslips.length}` },
          { label: "Potongan", value: formatRupiah(run.totalDeductions), hint: "Termasuk cicilan kasbon" },
        ]}
      />

      <Card className="p-0 sm:p-0">
        <ul className="flex flex-col divide-y divide-stone">
          {run.payslips.map((slip) => {
            const message = `Halo ${slip.name}, slip gaji ${label} dari ${companyName} sudah bisa dilihat di sini: ${site}/app/slip/${slip.id}`;
            const waHref = slip.phone
              ? `https://wa.me/${slip.phone}?text=${encodeURIComponent(message)}`
              : `https://wa.me/?text=${encodeURIComponent(message)}`;
            return (
              <li key={slip.id} className="flex flex-col gap-1 px-4 py-4 sm:px-6">
                <GajiRowHead name={slip.name} sub={slip.position ?? ""} netPay={slip.netPay} />
                <div className="pl-[3.25rem]">
                  <RincianToggle
                    actions={
                      <>
                        <a href={`/owner/gaji/slip/${slip.id}`} className="flex min-h-11 items-center text-sm text-graphite underline underline-offset-4 hover:text-ink">
                          Unduh slip
                        </a>
                        <KirimWaButton
                          payslipId={slip.id}
                          href={waHref}
                          sentLabel={slip.waSentAt ? `Terkirim ${formatDate(slip.waSentAt, timezone)}` : null}
                        />
                      </>
                    }
                  >
                    <PayslipLines lines={slip.lines} netPay={slip.netPay} />
                  </RincianToggle>
                </div>
              </li>
            );
          })}
        </ul>
      </Card>
    </>
  );
}

/** Kepala baris gajian: huruf awal, nama, keterangan, dan total dibayar. */
function GajiRowHead({ name, sub, netPay, inactive = false }: { name: string; sub: string; netPay: number; inactive?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full border border-stone bg-canvas text-sm font-medium text-graphite">
        {name.trim().charAt(0).toUpperCase() || "?"}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-ink">
          {name}
          {inactive && <span className="ml-2 text-xs font-normal text-ash">Nonaktif</span>}
        </p>
        {sub && <p className="truncate text-sm text-smoke">{sub}</p>}
      </div>
      <p className="shrink-0 text-right text-base font-medium text-ink tabular-nums sm:text-lg">{formatRupiah(netPay)}</p>
    </div>
  );
}

function LockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}
