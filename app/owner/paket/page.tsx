import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { FormAlert } from "@/app/(auth)/_components/form-alert";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Tag } from "@/components/ui/tag";
import { requireOwner } from "@/lib/auth/session";
import {
  isBillingCycle,
  planPrice,
  paidPlans,
  rangeLabel,
  yearlySaving,
  type BillingCycle,
} from "@/lib/billing/catalog";
import { getMidtransConfig } from "@/lib/billing/midtrans";
import { checkoutOption, type CurrentPaidPlan } from "@/lib/billing/payment";
import { processMidtransOrder } from "@/lib/billing/process";
import { getBillingOverview, getPlans, type BillingOverview } from "@/lib/billing/server";
import { daysLeft, quotaStatus } from "@/lib/billing/state";
import { cn } from "@/lib/cn";
import { formatDate, formatRupiah } from "@/lib/format";
import { FEATURE_KEYS } from "@/lib/plans";
import { getCompanyPlan } from "@/lib/plans-server";
import { createClient } from "@/lib/supabase/server";
import { FEATURE_INFO } from "../_components/menu";
import { BayarButton, TrialButton, TurunBenihButton } from "./paket-forms";
import { RefreshSoon } from "./refresh-soon";

export const metadata: Metadata = { title: "Paket" };

function statusTag(overview: BillingOverview): { label: string; tone: "accent" | "ink" | "outline" | "neutral" } {
  if (overview.level === "benih") return { label: "Gratis", tone: "neutral" };
  if (overview.status === "trialing") return { label: "Trial", tone: "accent" };
  if (overview.state === "baca_saja") return { label: "Baca saja", tone: "ink" };
  if (overview.state === "tenggang") return { label: "Menunggu pembayaran", tone: "outline" };
  return { label: "Aktif", tone: "neutral" };
}

function statusLine(overview: BillingOverview, timezone: string): string {
  if (overview.level === "benih") {
    return "Absen, data karyawan, dan gajian dasar gratis selamanya.";
  }
  if (overview.status === "trialing" && overview.trialEndsAt) {
    const left = daysLeft(overview.trialEndsAt);
    return `Trial berakhir ${formatDate(overview.trialEndsAt, timezone)} (${left} hari lagi). Setelah itu usahamu pindah ke Benih kalau belum memilih paket.`;
  }
  if (!overview.currentPeriodEnd) return "Paket berjalan.";
  const end = formatDate(overview.currentPeriodEnd, timezone);
  if (overview.state === "baca_saja") {
    return `Tagihan belum dibayar sejak ${end}. Data hanya bisa dilihat sampai tagihan dibayar atau kamu pindah ke Benih. Absen karyawan tetap jalan.`;
  }
  if (overview.state === "tenggang") {
    return `Masa aktif berakhir ${end}. Bayar dalam 7 hari supaya data tetap bisa diubah.`;
  }
  return `Aktif sampai ${end}.`;
}

export default async function PaketPage({
  searchParams,
}: {
  searchParams: Promise<{ siklus?: string; trial?: string; benih?: string; tagihan?: string }>;
}) {
  const owner = await requireOwner();
  if (!owner.onboardingCompleted) redirect("/owner/onboarding");

  const params = await searchParams;
  const cycle: BillingCycle = isBillingCycle(params.siklus) ? params.siklus : "bulanan";

  const supabase = await createClient();

  // Kembali dari halaman bayar: cek status langsung ke Midtrans, jaga-jaga
  // kalau webhook telat atau gagal. Hanya tagihan usaha ini (RLS owner).
  const config = getMidtransConfig();
  if (params.tagihan && owner.role === "owner" && config) {
    const { data: returning } = await supabase
      .from("invoices")
      .select("number, status")
      .eq("company_id", owner.companyId)
      .eq("number", params.tagihan)
      .maybeSingle();
    if (returning?.status === "pending") {
      await processMidtransOrder(config, returning.number, {
        payload: { sumber: "halaman_paket" },
        signatureValid: true,
        source: "cek_status",
      });
    }
  }

  const [overview, plans, companyPlan, { data: company }, { data: invoices }] = await Promise.all([
    getBillingOverview(owner.companyId),
    getPlans(),
    getCompanyPlan(owner.companyId),
    supabase.from("companies").select("timezone").eq("id", owner.companyId).maybeSingle(),
    // Tagihan hanya bisa dibaca owner (RLS); admin melihat daftar kosong.
    supabase
      .from("invoices")
      .select("id, number, amount, credit_amount, status, plan_code, billing_cycle, kind, checkout_url, expires_at, paid_at, period_end, created_at")
      .eq("company_id", owner.companyId)
      .order("created_at", { ascending: false })
      .limit(12),
  ]);
  const tz = company?.timezone ?? "Asia/Jakarta";
  const isOwner = owner.role === "owner";
  const tag = statusTag(overview);
  const quota = quotaStatus(overview.employeesUsed, overview.employeeLimit);
  const benih = plans.find((p) => p.level === "benih");
  const paid = paidPlans(plans, overview.employeesUsed);
  const canTrial = isOwner && !overview.trialUsed && overview.level === "benih";

  const planName = (code: string | null) => plans.find((p) => p.code === code)?.name ?? code ?? "Paket";
  const invoiceList = (invoices ?? []).filter((i) => i.status !== "void");
  const now = new Date();
  const pendingInvoice = invoiceList.find(
    (i) => i.status === "pending" && i.checkout_url && i.expires_at && new Date(i.expires_at) > now,
  );
  const returnedInvoice = params.tagihan ? invoiceList.find((i) => i.number === params.tagihan) : undefined;

  // Paket berbayar yang sedang berjalan, untuk menentukan Bayar / Upgrade / Perpanjang.
  const currentPlan = plans.find((p) => p.code === overview.planCode);
  const currentPaid: CurrentPaidPlan | null =
    overview.level === "benih" || !overview.status
      ? null
      : { status: overview.status, priceMonthly: currentPlan?.price_monthly ?? null, periodEnd: overview.currentPeriodEnd };

  const benihMax = benih?.max_employees ?? null;
  const overBenih = benihMax !== null && overview.employeesUsed > benihMax ? overview.employeesUsed - benihMax : 0;
  const downgradeWarning =
    overBenih > 0
      ? `Benih hanya untuk ${benihMax} karyawan: setelah 14 hari, ${overBenih} karyawan yang paling baru ditambahkan disembunyikan dari dashboard (tetap bisa absen).`
      : null;

  // Fitur yang terbuka di paket berbayar (dibaca dari plan_features).
  const paidFeatures = FEATURE_KEYS.filter((key) => {
    const level = companyPlan.minLevel[key];
    return level !== undefined && level !== "benih";
  })
    .map((key) => FEATURE_INFO[key]?.label)
    .filter((label): label is string => Boolean(label));

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl sm:text-4xl">Paket</h1>
        <p className="text-smoke">Absen karyawan tetap jalan di paket apa pun. Paket hanya menentukan fitur untukmu.</p>
      </div>

      {params.trial === "mulai" && overview.status === "trialing" && overview.trialEndsAt && (
        <FormAlert tone="success">
          Trial {overview.planName} dimulai. Semua fitur terbuka sampai {formatDate(overview.trialEndsAt, tz)}.
        </FormAlert>
      )}
      {params.benih === "1" && overview.level === "benih" && (
        <FormAlert tone="success">Usahamu sekarang memakai paket Benih.</FormAlert>
      )}
      {returnedInvoice && (
        <ReturnNotice
          status={returnedInvoice.status}
          planName={planName(returnedInvoice.plan_code)}
          periodEnd={returnedInvoice.period_end}
          timezone={tz}
        />
      )}

      {pendingInvoice && returnedInvoice?.id !== pendingInvoice.id && (
        <Card className="flex flex-col gap-3 border border-stone bg-canvas sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Tag tone="outline">Menunggu pembayaran</Tag>
            <CardTitle className="mt-3">
              {formatRupiah(pendingInvoice.amount)} · {planName(pendingInvoice.plan_code)}{" "}
              {pendingInvoice.billing_cycle === "tahunan" ? "tahunan" : "bulanan"}
            </CardTitle>
            <CardDescription>
              Bayar lewat virtual account bank atau QRIS sebelum{" "}
              {pendingInvoice.expires_at ? formatDateTime(pendingInvoice.expires_at, tz) : "tagihan kedaluwarsa"}.
            </CardDescription>
          </div>
          {pendingInvoice.checkout_url && (
            <a
              href={pendingInvoice.checkout_url}
              className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-button border border-stone px-4 text-sm font-medium text-ink hover:border-graphite hover:bg-taupe"
            >
              Lanjutkan pembayaran
            </a>
          )}
        </Card>
      )}

      <Card>
        <Tag tone={tag.tone}>{tag.label}</Tag>
        <CardTitle className="mt-3">{overview.planName}</CardTitle>
        <CardDescription>{statusLine(overview, tz)}</CardDescription>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-ash">Karyawan</dt>
            <dd className="text-ink">
              {quota ? quota.text : `${overview.employeesUsed} karyawan · tanpa batas`}
            </dd>
          </div>
          {overview.billingCycle && overview.status !== "trialing" && (
            <div>
              <dt className="text-ash">Pembayaran</dt>
              <dd className="text-ink">{overview.billingCycle === "tahunan" ? "Tahunan" : "Bulanan"}</dd>
            </div>
          )}
        </dl>
        {overview.hiddenCount > 0 && (
          <p className="mt-3 text-sm text-graphite">
            {overview.hiddenCount} karyawan disembunyikan karena melewati batas paket. Data mereka tidak dihapus
            dan muncul lagi setelah upgrade.
          </p>
        )}
        {canTrial && (
          <div className="mt-5 flex flex-col gap-2 sm:max-w-xs">
            <TrialButton />
            <p className="text-xs text-ash">Sekali per usaha, tanpa kartu kredit. Setelah 14 hari kembali ke Benih.</p>
          </div>
        )}
      </Card>

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h2 className="text-2xl">Pilih paket</h2>
            <p className="text-sm text-smoke">
              Harga mengikuti jumlah karyawan aktif dan yang masih diundang. Bayar tahunan gratis 2 bulan.
            </p>
          </div>
          <CycleToggle cycle={cycle} />
        </div>

        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {benih && (
            <li className="flex">
              <PlanCard
                name="Benih"
                range={rangeLabel(benih)}
                note="Absen, rekap, dan gajian dasar"
                current={overview.level === "benih" ? "Paket kamu" : null}
                price={<p className="font-display text-3xl">Gratis</p>}
                action={
                  isOwner && overview.level !== "benih" ? (
                    <TurunBenihButton planName={overview.planName} warning={downgradeWarning} />
                  ) : null
                }
              />
            </li>
          )}
          {paid.map(({ plan, label, range, fits }) => {
            const price = planPrice(plan, cycle);
            const current = overview.planCode === plan.code;
            return (
              <li key={plan.code} className="flex">
                <PlanCard
                  name={label}
                  range={range}
                  note={fits ? "Semua fitur" : `Karyawanmu ${overview.employeesUsed}, melebihi batas paket ini`}
                  dimmed={!fits}
                  current={current ? (overview.status === "trialing" ? "Trial kamu" : "Paket kamu") : null}
                  price={
                    price === null ? (
                      <p className="text-sm text-graphite">Harga khusus. Hubungi tim Semai lewat email akunmu.</p>
                    ) : (
                      <div>
                        <p className="font-display text-3xl">
                          {formatRupiah(price)}
                          <span className="font-sans text-sm text-smoke">/{cycle === "tahunan" ? "tahun" : "bulan"}</span>
                        </p>
                        {cycle === "tahunan" && yearlySaving(plan) > 0 && (
                          <p className="text-xs text-smoke">Hemat {formatRupiah(yearlySaving(plan))}</p>
                        )}
                      </div>
                    )
                  }
                  action={
                    price !== null && plan.price_monthly !== null && fits && isOwner ? (
                      <PlanAction
                        planCode={plan.code}
                        cycle={cycle}
                        price={price}
                        option={checkoutOption(currentPaid, plan.price_monthly, now)}
                        isCurrent={current && currentPaid !== null && currentPaid.status !== "trialing"}
                        timezone={tz}
                      />
                    ) : null
                  }
                />
              </li>
            );
          })}
        </ul>
        <p className="text-sm text-ash">
          Bayar lewat virtual account bank atau QRIS. Tagihan berlaku 24 jam. Upgrade di tengah periode memotong
          sisa nilai paket lama; perpanjangan bisa dibayar mulai 7 hari sebelum paket berakhir.
        </p>
      </section>

      <Card>
        <CardTitle>Isi paket berbayar</CardTitle>
        <CardDescription>Semua fitur Benih, ditambah:</CardDescription>
        <FeatureList items={paidFeatures} />
      </Card>

      {invoiceList.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-2xl">Riwayat tagihan</h2>
          <ul className="flex flex-col divide-y divide-stone overflow-hidden rounded-card bg-taupe">
            {invoiceList.map((invoice) => (
              <li key={invoice.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <p className="font-medium text-ink">
                    {planName(invoice.plan_code)} · {invoice.billing_cycle === "tahunan" ? "tahunan" : "bulanan"}
                    {invoice.kind === "upgrade" && " · upgrade"}
                    {invoice.kind === "perpanjang" && " · perpanjang"}
                  </p>
                  <p className="text-sm text-smoke">
                    <span className="font-mono">{invoice.number}</span> · {formatDate(invoice.paid_at ?? invoice.created_at, tz)}
                    {invoice.credit_amount > 0 && ` · potongan ${formatRupiah(invoice.credit_amount)}`}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-ink">{formatRupiah(invoice.amount)}</span>
                  <InvoiceTag status={invoice.status} expired={Boolean(invoice.expires_at && new Date(invoice.expires_at) <= now)} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function FeatureList({ items }: { items: string[] }) {
  return (
    <ul className="mt-3 flex flex-col gap-1.5 text-sm text-graphite">
      {items.map((item) => (
        <li key={item} className="flex gap-2">
          <span aria-hidden className="text-ash">
            ·
          </span>
          {item}
        </li>
      ))}
    </ul>
  );
}

function CycleToggle({ cycle }: { cycle: BillingCycle }) {
  const options: { value: BillingCycle; label: string }[] = [
    { value: "bulanan", label: "Bulanan" },
    { value: "tahunan", label: "Tahunan · hemat 2 bulan" },
  ];
  return (
    <div role="group" aria-label="Siklus pembayaran" className="flex rounded-button border border-stone p-1">
      {options.map((option) => (
        <Link
          key={option.value}
          href={`/owner/paket?siklus=${option.value}`}
          scroll={false}
          aria-current={cycle === option.value ? "true" : undefined}
          className={cn(
            "flex min-h-9 items-center rounded-[7px] px-3 text-sm",
            cycle === option.value ? "bg-ink text-canvas" : "text-graphite hover:text-ink",
          )}
        >
          {option.label}
        </Link>
      ))}
    </div>
  );
}

/** Satu kartu paket di grid "Pilih paket". */
function PlanCard({
  name,
  range,
  note,
  current,
  price,
  action,
  dimmed = false,
}: {
  name: string;
  range: string;
  note: string;
  current: string | null;
  price: React.ReactNode;
  action: React.ReactNode;
  dimmed?: boolean;
}) {
  return (
    <Card className={cn("flex w-full flex-col gap-4", current && "outline-2 outline-ink", dimmed && "opacity-60")}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <CardTitle>{name}</CardTitle>
          <p className="text-sm text-smoke">{range}</p>
        </div>
        {current && <Tag tone="ink">{current}</Tag>}
      </div>
      {price}
      <p className="text-sm text-graphite">{note}</p>
      {action && <div className="mt-auto pt-2">{action}</div>}
    </Card>
  );
}

function formatDateTime(value: string, timezone: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: timezone,
  }).format(new Date(value));
}

function InvoiceTag({ status, expired }: { status: string; expired: boolean }) {
  if (status === "paid") return <Tag>Lunas</Tag>;
  if (status === "pending" && !expired) return <Tag tone="outline">Menunggu</Tag>;
  if (status === "failed") return <Tag tone="outline">Gagal</Tag>;
  return <Tag tone="outline">Kedaluwarsa</Tag>;
}

/** Pesan setelah kembali dari halaman bayar Midtrans (?tagihan=NOMOR). */
function ReturnNotice({
  status,
  planName,
  periodEnd,
  timezone,
}: {
  status: string;
  planName: string;
  periodEnd: string | null;
  timezone: string;
}) {
  if (status === "paid") {
    return (
      <FormAlert tone="success">
        Pembayaran diterima. Paket {planName} aktif{periodEnd ? ` sampai ${formatDate(periodEnd, timezone)}` : ""}.
      </FormAlert>
    );
  }
  if (status === "pending") {
    return (
      <FormAlert tone="success">
        <RefreshSoon />
        Menunggu konfirmasi pembayaran dari Midtrans. Halaman ini diperbarui otomatis. Kalau belum bayar, lanjutkan
        lewat tombol di bawah.
      </FormAlert>
    );
  }
  return (
    <FormAlert tone="error">
      Tagihan {planName} {status === "failed" ? "gagal dibayar" : "sudah kedaluwarsa"}. Pilih paket lagi untuk membuat
      tagihan baru.
    </FormAlert>
  );
}

/** Tombol di kartu paket: Bayar, Upgrade, Perpanjang, atau belum waktunya. */
function PlanAction({
  planCode,
  cycle,
  price,
  option,
  isCurrent,
  timezone,
}: {
  planCode: string;
  cycle: BillingCycle;
  price: number;
  option: ReturnType<typeof checkoutOption>;
  isCurrent: boolean;
  timezone: string;
}) {
  if (option.opensAt) {
    return (
      <Button variant="secondary" arrow={false} fullWidth disabled>
        {isCurrent ? "Perpanjang" : "Pilih"} mulai {formatDate(option.opensAt, timezone)}
      </Button>
    );
  }
  const label =
    option.kind === "upgrade"
      ? "Upgrade ke paket ini"
      : option.kind === "perpanjang"
        ? isCurrent
          ? `Perpanjang · ${formatRupiah(price)}`
          : `Pilih untuk periode berikutnya · ${formatRupiah(price)}`
        : `Bayar ${formatRupiah(price)}`;
  return <BayarButton planCode={planCode} cycle={cycle} label={label} primary={option.kind !== "perpanjang" || isCurrent} />;
}
