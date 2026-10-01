import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Tag } from "@/components/ui/tag";
import { businessTypeLabel } from "@/lib/admin/filters";
import {
  AUDIT_ACTION_LABEL,
  BILLING_STATE_LABEL,
  CYCLE_LABEL,
  INVOICE_KIND_LABEL,
  INVOICE_STATUS_LABEL,
  PROVIDER_LABEL,
  SUBSCRIPTION_STATUS_LABEL,
  label,
} from "@/lib/admin/labels";
import { getCompanyDetail, getCompanyHistory, listPlans } from "@/lib/admin/server";
import { formatDate, formatRupiah, formatTime } from "@/lib/format";
import {
  DiskonButton,
  PerpanjangTrialButton,
  SuspendButton,
  UbahPaketButton,
  type PlanOption,
} from "./_components/admin-actions";

export const metadata: Metadata = { title: "Detail usaha" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function dateOrDash(value: string | null | undefined): string {
  return value ? formatDate(value) : "–";
}

function Row({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-stone py-2.5 text-sm last:border-0">
      <dt className="text-smoke">{term}</dt>
      <dd className="text-right text-ink">{children}</dd>
    </div>
  );
}

function Count({ label, value, note }: { label: string; value: number; note?: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-button bg-canvas p-3">
      <span className="text-xs text-smoke">{label}</span>
      <span className="font-mono text-xl text-ink">{value.toLocaleString("id-ID")}</span>
      {note && <span className="text-xs text-ash">{note}</span>}
    </div>
  );
}

export default async function DetailUsahaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const [detail, history, plans] = await Promise.all([getCompanyDetail(id), getCompanyHistory(id), listPlans()]);
  if (!detail) notFound();

  const { company, owner, plan, usage } = detail;
  const sub = plan.subscription;
  const trialing = sub?.status === "trialing";
  const paid = sub && !trialing;
  const planOptions: PlanOption[] = plans
    .filter((p) => p.level !== "dasar")
    .map((p) => ({ code: p.code, name: p.name, priceMonthly: p.price_monthly, priceYearly: p.price_yearly }));
  const planName = (code: string | null) => plans.find((p) => p.code === code)?.name ?? code ?? "–";

  const trialHint = trialing
    ? `Trial berjalan sampai ${dateOrDash(sub?.trial_ends_at)}.`
    : plan.trial_used
      ? "Trial sudah pernah dipakai; perpanjang akan membuka trial lagi."
      : "Belum pernah trial; usaha ini diberi trial baru.";

  return (
    <>
      <div className="flex flex-col gap-2">
        <Link href="/admin/usaha" className="text-sm text-smoke underline-offset-4 hover:text-ink hover:underline">
          ← Daftar usaha
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-3xl sm:text-4xl">{company.name ?? "Tanpa nama"}</h1>
          {company.suspended_at && <Tag tone="ink">Ditangguhkan</Tag>}
        </div>
        <p className="text-sm text-smoke">
          {businessTypeLabel(company.business_type)} · {company.city ?? "–"} · daftar {formatDate(company.created_at)}
          <span className="font-mono text-ash"> · {company.id}</span>
        </p>
      </div>

      {company.suspended_at && (
        <Card className="border border-ink">
          <CardTitle>Ditangguhkan sejak {formatDate(company.suspended_at)}</CardTitle>
          <CardDescription>
            Alasan: {company.suspend_reason ?? "–"}. Owner tidak bisa mengubah data; absen karyawan tetap jalan.
          </CardDescription>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle>Paket</CardTitle>
          <dl className="mt-3">
            <Row term="Paket sekarang">
              <span className="inline-flex items-center gap-1.5">
                {plan.plan_name ?? plan.plan_code}
                {trialing && <Tag tone="outline">Trial</Tag>}
              </span>
            </Row>
            {sub && <Row term="Status">{label(SUBSCRIPTION_STATUS_LABEL, sub.status)}</Row>}
            <Row term="Status tagihan">{label(BILLING_STATE_LABEL, plan.billing_state)}</Row>
            {paid && <Row term="Siklus">{label(CYCLE_LABEL, sub.billing_cycle)}</Row>}
            {trialing && <Row term="Trial sampai">{dateOrDash(sub.trial_ends_at)}</Row>}
            {paid && <Row term="Periode sampai">{dateOrDash(sub.current_period_end)}</Row>}
            {paid && <Row term="Pembayaran">{label(PROVIDER_LABEL, sub.provider)}</Row>}
            {paid && sub.price_override !== null && (
              <Row term="Harga khusus">{formatRupiah(sub.price_override)} / periode</Row>
            )}
            {paid && <Row term="MRR">{sub.mrr !== null ? formatRupiah(sub.mrr) : "–"}</Row>}
            <Row term="Diskon">
              {company.discount_percent
                ? `${company.discount_percent}%${company.discount_until ? ` sampai ${formatDate(company.discount_until)}` : ""}${
                    company.discount_active ? "" : " (sudah lewat)"
                  }`
                : "–"}
            </Row>
          </dl>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <UbahPaketButton companyId={company.id} plans={planOptions} currentPlan={plan.plan_code} />
            {!paid && <PerpanjangTrialButton companyId={company.id} hint={trialHint} />}
            <DiskonButton companyId={company.id} hasDiscount={company.discount_percent !== null} />
            <SuspendButton companyId={company.id} suspended={company.suspended_at !== null} />
          </div>
        </Card>

        <Card>
          <CardTitle>Owner dan usaha</CardTitle>
          <dl className="mt-3">
            <Row term="Nama owner">{owner?.name ?? "–"}</Row>
            <Row term="Email">{owner?.email ?? "–"}</Row>
            <Row term="WhatsApp">
              {owner?.phone ? (
                <a
                  href={`https://wa.me/${owner.phone.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-4"
                >
                  {owner.phone}
                </a>
              ) : (
                "–"
              )}
            </Row>
            <Row term="Zona waktu">{company.timezone.replace("Asia/", "")}</Row>
            <Row term="Rentang karyawan (onboarding)">{company.employee_range ?? "–"}</Row>
            <Row term="Selesai onboarding">{dateOrDash(company.onboarding_completed_at)}</Row>
            <Row term="Terakhir aktif">
              {company.last_active_at
                ? `${formatDate(company.last_active_at)}, ${formatTime(company.last_active_at)} WIB`
                : "Belum pernah"}
            </Row>
          </dl>
        </Card>
      </div>

      <Card>
        <CardTitle>Pemakaian</CardTitle>
        <CardDescription>Hanya jumlah. Nama, foto, lokasi, dan nominal gaji karyawan tidak ditampilkan.</CardDescription>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <Count
            label="Karyawan aktif"
            value={usage.employees_active}
            note={usage.employees_hidden > 0 ? `${usage.employees_hidden} disembunyikan` : undefined}
          />
          <Count label="Diundang" value={usage.employees_invited} />
          <Count label="Absen 7 hari" value={usage.attendances_7d} />
          <Count label="Absen 30 hari" value={usage.attendances_30d} />
          <Count label="Total absen" value={usage.attendances_total} />
          <Count
            label="Gajian diproses"
            value={usage.payroll_runs}
            note={`${usage.payroll_locked} dikunci`}
          />
          <Count label="Lokasi aktif" value={usage.locations} />
          <Count label="Admin tambahan" value={usage.admins} />
          <Count label="Karyawan nonaktif" value={usage.employees_inactive} />
        </div>
        <p className="mt-3 text-xs text-ash">
          Absen terakhir: {usage.last_attendance_at ? formatDate(usage.last_attendance_at) : "belum ada"} · Gajian
          terakhir: {usage.last_payroll_period ? `periode s.d. ${formatDate(usage.last_payroll_period)}` : "belum ada"}
        </p>
      </Card>

      <Card>
        <CardTitle>Tagihan</CardTitle>
        {history.invoices.length === 0 ? (
          <CardDescription>Belum ada tagihan.</CardDescription>
        ) : (
          <ul className="mt-3 flex flex-col">
            {history.invoices.map((inv) => (
              <li key={inv.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-stone py-2.5 text-sm last:border-0">
                <span className="flex flex-col">
                  <span className="font-mono text-xs text-graphite">{inv.number}</span>
                  <span className="text-smoke">
                    {planName(inv.plan_code)} {label(CYCLE_LABEL, inv.billing_cycle).toLowerCase()} ·{" "}
                    {label(INVOICE_KIND_LABEL, inv.kind)} · {formatDate(inv.created_at)}
                    {inv.discount_amount > 0 && ` · diskon ${formatRupiah(inv.discount_amount)}`}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  <span className="font-mono">{formatRupiah(inv.amount)}</span>
                  <Tag tone={inv.status === "paid" ? "accent" : inv.status === "failed" ? "ink" : "outline"}>
                    {label(INVOICE_STATUS_LABEL, inv.status)}
                  </Tag>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle>Riwayat langganan</CardTitle>
          {history.subscriptions.length === 0 ? (
            <CardDescription>Belum pernah berlangganan atau trial.</CardDescription>
          ) : (
            <ul className="mt-3 flex flex-col">
              {history.subscriptions.map((s) => (
                <li key={s.id} className="flex flex-col border-b border-stone py-2.5 text-sm last:border-0">
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-ink">
                      {planName(s.plan_code)} {s.trial_ends_at ? "(trial)" : `· ${label(CYCLE_LABEL, s.billing_cycle).toLowerCase()}`}
                    </span>
                    <Tag tone="outline">{label(SUBSCRIPTION_STATUS_LABEL, s.status)}</Tag>
                  </span>
                  <span className="text-smoke">
                    {dateOrDash(s.current_period_start)} – {dateOrDash(s.ended_at ?? s.current_period_end)} ·{" "}
                    {label(PROVIDER_LABEL, s.provider)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardTitle>Catatan audit</CardTitle>
          <CardDescription>Perubahan paket, tagihan, dan aksi tim Semai.</CardDescription>
          {history.audit.length === 0 ? (
            <p className="mt-3 text-sm text-smoke">Belum ada catatan.</p>
          ) : (
            <ul className="mt-3 flex flex-col">
              {history.audit.map((log) => (
                <li key={log.id} className="flex flex-col border-b border-stone py-2.5 text-sm last:border-0">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="text-ink">{label(AUDIT_ACTION_LABEL, log.action)}</span>
                    <span className="shrink-0 text-xs text-smoke">
                      {formatDate(log.created_at)}, {formatTime(log.created_at)}
                    </span>
                  </span>
                  {log.reason && <span className="text-smoke">Alasan: {log.reason}</span>}
                  <span className="text-xs text-ash">
                    {log.actor_role === "platform_admin" ? "Tim Semai" : log.actor_role === "system" ? "Sistem" : "Owner"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
