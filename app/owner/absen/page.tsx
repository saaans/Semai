import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Tag } from "@/components/ui/tag";
import { getMonthlyRecap } from "@/lib/attendance/owner";
import type { RecapSummary } from "@/lib/attendance/recap";
import { requireOwner } from "@/lib/auth/session";
import { cn } from "@/lib/cn";
import { formatMinutes } from "@/lib/format";
import { MonthNav } from "../_components/month-nav";

export const metadata: Metadata = { title: "Rekap absen" };

function lembur(summary: RecapSummary) {
  return summary.lemburDisetujui > 0 ? formatMinutes(summary.lemburDisetujui) : "–";
}

export default async function RekapAbsenPage({ searchParams }: { searchParams: Promise<{ bulan?: string }> }) {
  const owner = await requireOwner();
  if (!owner.onboardingCompleted) redirect("/owner/onboarding");

  const { bulan } = await searchParams;
  const recap = await getMonthlyRecap(owner.companyId, bulan);
  const { totals } = recap;

  const cards = [
    { label: "Hadir", value: `${totals.hadir}`, hint: "hari, semua karyawan" },
    { label: "Telat", value: `${totals.telatKali}`, hint: totals.telatMenit > 0 ? `kali · total ${formatMinutes(totals.telatMenit)}` : "kali" },
    { label: "Tidak masuk", value: `${totals.tidakMasuk}`, hint: totals.izin > 0 ? `hari · ${totals.izin} hari izin/sakit` : "hari" },
    {
      label: "Lembur disetujui",
      value: totals.lemburDisetujui > 0 ? formatMinutes(totals.lemburDisetujui) : "0",
      hint: totals.lemburMenunggu > 0 ? `${formatMinutes(totals.lemburMenunggu)} menunggu persetujuan` : undefined,
    },
  ];

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl sm:text-4xl">Rekap absen</h1>
          <p className="text-smoke">Ketuk nama karyawan untuk melihat absen per hari dan koreksi.</p>
        </div>
        <MonthNav basePath="/owner/absen" month={recap.month} prevMonth={recap.prevMonth} nextMonth={recap.nextMonth} />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.label} className="p-4 sm:p-5">
            <p className="text-sm text-smoke">{card.label}</p>
            <p className="mt-1 font-display text-3xl">{card.value}</p>
            {card.hint && <p className="mt-1 text-xs text-ash">{card.hint}</p>}
          </Card>
        ))}
      </div>

      {recap.employees.length === 0 ? (
        <p className="text-sm text-smoke">Belum ada karyawan aktif di bulan ini.</p>
      ) : (
        <>
          {/* HP: kartu per karyawan */}
          <ul className="flex flex-col gap-3 md:hidden">
            {recap.employees.map((employee) => (
              <li key={employee.id}>
                <Link href={`/owner/absen/${employee.id}?bulan=${recap.month}`} className="block rounded-card bg-taupe p-4 hover:bg-stone">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium text-ink">{employee.name}</span>
                    {!employee.active && <Tag tone="outline">Nonaktif</Tag>}
                  </div>
                  <dl className="mt-3 grid grid-cols-4 gap-2 text-center text-sm">
                    {[
                      ["Hadir", employee.summary.hadir],
                      ["Telat", employee.summary.telatKali],
                      ["Izin", employee.summary.izin],
                      ["Absen", employee.summary.tidakMasuk],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <dt className="text-xs text-smoke">{label}</dt>
                        <dd className={cn("tabular-nums", value === 0 ? "text-ash" : "text-ink")}>{value}</dd>
                      </div>
                    ))}
                  </dl>
                  <p className="mt-2 text-xs text-smoke">
                    Lembur {lembur(employee.summary)}
                    {employee.summary.lemburMenunggu > 0 && ` · ${formatMinutes(employee.summary.lemburMenunggu)} menunggu`}
                  </p>
                </Link>
              </li>
            ))}
          </ul>

          {/* Laptop: tabel */}
          <div className="hidden overflow-x-auto rounded-card bg-taupe md:block">
            <table className="w-full table-fixed text-sm">
              <colgroup>
                <col />
                <col className="w-20" />
                <col className="w-20" />
                <col className="w-36" />
                <col className="w-24" />
                <col className="w-28" />
                <col className="w-56" />
              </colgroup>
              <thead>
                <tr className="text-left text-xs text-ash">
                  <th className="px-6 py-3 font-normal">Karyawan</th>
                  <th className="px-3 py-3 text-right font-normal">Hadir</th>
                  <th className="px-3 py-3 text-right font-normal">Telat</th>
                  <th className="px-3 py-3 text-right font-normal">Total telat</th>
                  <th className="px-3 py-3 text-right font-normal">Izin/sakit</th>
                  <th className="px-3 py-3 text-right font-normal">Tidak masuk</th>
                  <th className="px-6 py-3 text-right font-normal whitespace-nowrap">Lembur disetujui</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone border-t border-stone">
                {recap.employees.map((employee) => {
                  const s = employee.summary;
                  return (
                    <tr key={employee.id} className="transition-colors hover:bg-ink/[0.03]">
                      <td className="px-6 py-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full border border-stone bg-canvas text-xs font-medium text-graphite">
                            {employee.name.trim().charAt(0).toUpperCase() || "?"}
                          </span>
                          <Link href={`/owner/absen/${employee.id}?bulan=${recap.month}`} className="truncate font-medium text-ink underline-offset-4 hover:underline">
                            {employee.name}
                          </Link>
                          {!employee.active && <span className="shrink-0 text-xs text-ash">Nonaktif</span>}
                        </div>
                      </td>
                      <Num value={s.hadir} />
                      <Num value={s.telatKali} />
                      <td className={cn("px-3 py-3 text-right tabular-nums", s.telatMenit > 0 ? "text-ink" : "text-ash")}>
                        {s.telatMenit > 0 ? formatMinutes(s.telatMenit) : "–"}
                      </td>
                      <Num value={s.izin} />
                      <Num value={s.tidakMasuk} />
                      <td className="px-6 py-3 text-right tabular-nums">
                        <span className={s.lemburDisetujui > 0 ? "text-ink" : "text-ash"}>{lembur(s)}</span>
                        {s.lemburMenunggu > 0 && (
                          <span className="block text-xs whitespace-nowrap text-smoke">+{formatMinutes(s.lemburMenunggu)} menunggu</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
      <p className="text-xs text-ash">
        Tidak masuk = hari kerja yang lewat tanpa absen, ditambah hari yang dicatat tidak masuk.
        Izin dan sakit dihitung terpisah.
      </p>
    </>
  );
}

/** Sel angka: nol dibuat samar supaya angka yang penting lebih terbaca. */
function Num({ value }: { value: number }) {
  return <td className={cn("px-3 py-3 text-right tabular-nums", value === 0 ? "text-ash" : "text-ink")}>{value}</td>;
}
