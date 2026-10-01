import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { formatPercent } from "@/lib/admin/metrics";
import { getDashboardMetrics } from "@/lib/admin/server";
import { formatRupiah } from "@/lib/format";

export const metadata: Metadata = { title: "Ringkasan bisnis" };

function Stat({
  label,
  value,
  note,
  href,
}: {
  label: string;
  value: string;
  note?: string;
  href?: string;
}) {
  const body = (
    <Card className="flex h-full flex-col gap-1">
      <p className="text-sm text-smoke">{label}</p>
      <p className="font-display text-3xl tracking-tight sm:text-4xl">{value}</p>
      {note && <p className="text-xs text-ash">{note}</p>}
    </Card>
  );
  return href ? (
    <Link href={href} className="rounded-card focus-visible:outline-2 focus-visible:outline-ink">
      {body}
    </Link>
  ) : (
    body
  );
}

export default async function AdminPage() {
  const m = await getDashboardMetrics();
  const maxPlan = Math.max(1, ...m.per_plan.map((p) => p.companies + p.trialing));

  return (
    <>
      <div>
        <h1 className="text-3xl sm:text-4xl">Ringkasan bisnis</h1>
        <p className="mt-1 text-sm text-smoke">Semua usaha yang sudah selesai onboarding, tanpa data pribadi karyawan.</p>
      </div>

      <section aria-label="Angka utama" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Usaha terdaftar"
          value={m.registered.toLocaleString("id-ID")}
          note={`+${m.new_30d.toLocaleString("id-ID")} dalam 30 hari`}
          href="/admin/usaha"
        />
        <Stat
          label="Aktif mingguan"
          value={m.active_7d.toLocaleString("id-ID")}
          note={`${formatPercent(m.activeRate)} ada absen 7 hari terakhir`}
          href="/admin/usaha?aktif=7_hari"
        />
        <Stat
          label="MRR"
          value={formatRupiah(m.mrr)}
          note={
            m.mrr_custom_unpriced > 0
              ? `${m.paying} usaha berbayar, ${m.mrr_custom_unpriced} harga custom belum diisi`
              : `${m.paying} usaha berbayar`
          }
        />
        <Stat
          label="Churn 30 hari"
          value={formatPercent(m.churnRate)}
          note={`${m.churned} dari ${m.churn_base} usaha berbayar berhenti`}
        />
        <Stat
          label="Konversi gratis → berbayar"
          value={formatPercent(m.conversionRate)}
          note={`${m.ever_paid} usaha pernah membayar`}
        />
        <Stat
          label="Trial → bayar"
          value={formatPercent(m.trialConversionRate)}
          note={`${m.trial_paid} dari ${m.trial_done} trial yang selesai`}
        />
        <Stat
          label="Sedang trial"
          value={m.trialing.toLocaleString("id-ID")}
          href="/admin/usaha?paket=trial"
        />
        <Stat label="Berbayar sekarang" value={m.paying.toLocaleString("id-ID")} />
      </section>

      <Card>
        <h2 className="text-xl">Usaha per paket</h2>
        <p className="mt-1 text-sm text-smoke">Paket yang berlaku sekarang. Trial dihitung terpisah.</p>
        <ul className="mt-4 flex flex-col gap-3">
          {m.per_plan.map((p) => {
            const total = p.companies + p.trialing;
            return (
              <li key={p.plan_code}>
                <Link
                  href={`/admin/usaha?paket=${p.plan_code}`}
                  className="flex flex-col gap-1.5 rounded-button py-1 hover:bg-canvas/60"
                >
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="font-medium text-ink">{p.name}</span>
                    <span className="font-mono text-graphite">
                      {p.companies.toLocaleString("id-ID")}
                      {p.trialing > 0 && <span className="text-smoke"> + {p.trialing} trial</span>}
                    </span>
                  </div>
                  <div className="flex h-2 overflow-hidden rounded-full bg-stone" aria-hidden>
                    <div className="bg-ink" style={{ width: `${(p.companies / maxPlan) * 100}%` }} />
                    <div className="bg-ash" style={{ width: `${(p.trialing / maxPlan) * 100}%` }} />
                  </div>
                  <span className="sr-only">{`${p.name}: ${total} usaha`}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </Card>

      <p className="text-xs text-ash">
        MRR: langganan berbayar aktif atau masih dalam tenggang 7 hari, tahunan dibagi 12, sesudah diskon. Churn:
        berbayar 30 hari lalu dan tidak membayar sekarang.
      </p>
    </>
  );
}
