import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Tag } from "@/components/ui/tag";
import { PAGE_SIZE } from "@/lib/admin/filters";
import { CYCLE_LABEL, INVOICE_KIND_LABEL, INVOICE_STATUS_LABEL, label, paymentEventLabel } from "@/lib/admin/labels";
import {
  INVOICE_TABS,
  invoiceSummary,
  listInvoices,
  listPaymentProblems,
  listPlans,
  type InvoiceTab,
} from "@/lib/admin/server";
import { cn } from "@/lib/cn";
import { formatDate, formatRupiah, formatTime } from "@/lib/format";
import { Pagination } from "../_components/pagination";

export const metadata: Metadata = { title: "Tagihan" };

const TAB_LABEL: Record<InvoiceTab, string> = {
  semua: "Semua",
  menunggu: "Menunggu bayar",
  lunas: "Lunas",
  gagal: "Pembayaran gagal",
};

function isTab(value: unknown): value is InvoiceTab {
  return typeof value === "string" && (INVOICE_TABS as readonly string[]).includes(value);
}

function isOverdue(status: string, dueAt: string | null): boolean {
  return status === "pending" && dueAt !== null && new Date(dueAt).getTime() < Date.now();
}

function tabHref(tab: InvoiceTab, page = 1) {
  const params = new URLSearchParams();
  if (tab !== "semua") params.set("status", tab);
  if (page > 1) params.set("hal", String(page));
  const q = params.toString();
  return `/admin/tagihan${q ? `?${q}` : ""}`;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="flex flex-col gap-1">
      <p className="text-sm text-smoke">{label}</p>
      <p className="font-display text-3xl tracking-tight">{value}</p>
    </Card>
  );
}

export default async function TagihanPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const tab: InvoiceTab = isTab(params.status) ? params.status : "semua";
  const pageNum = Number(params.hal);
  const page = Number.isInteger(pageNum) && pageNum > 0 ? pageNum : 1;

  const [summary, { rows, total }, problems, plans] = await Promise.all([
    invoiceSummary(),
    listInvoices(tab, page),
    tab === "gagal" ? listPaymentProblems() : Promise.resolve(null),
    listPlans(),
  ]);
  const planName = (code: string | null) => plans.find((p) => p.code === code)?.name ?? code ?? "–";

  return (
    <>
      <div>
        <h1 className="text-3xl sm:text-4xl">Tagihan</h1>
        <p className="mt-1 text-sm text-smoke">Invoice langganan dari semua usaha.</p>
      </div>

      <section aria-label="Ringkasan tagihan" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Diterima 30 hari" value={formatRupiah(summary.paid30d)} />
        <Stat label="Menunggu bayar" value={summary.pending.toLocaleString("id-ID")} />
        <Stat label="Lewat jatuh tempo" value={summary.overdue.toLocaleString("id-ID")} />
        <Stat label="Gagal 30 hari" value={summary.failed30d.toLocaleString("id-ID")} />
      </section>

      <nav aria-label="Status tagihan" className="-mx-1 flex gap-1 overflow-x-auto">
        {INVOICE_TABS.map((t) => (
          <Link
            key={t}
            href={tabHref(t)}
            aria-current={t === tab ? "page" : undefined}
            className={cn(
              "flex min-h-11 items-center rounded-full border px-4 text-sm whitespace-nowrap",
              t === tab ? "border-ink bg-ink text-canvas" : "border-stone text-graphite hover:border-graphite",
            )}
          >
            {TAB_LABEL[t]}
          </Link>
        ))}
      </nav>

      {problems && (
        <Card>
          <CardTitle>Notifikasi pembayaran bermasalah</CardTitle>
          <CardDescription>
            Notifikasi Midtrans dengan tanda tangan salah, nominal beda, atau gagal disimpan. Cek di dashboard Midtrans
            sebelum mengubah paket manual.
          </CardDescription>
          {problems.length === 0 ? (
            <p className="mt-3 text-sm text-smoke">Tidak ada. Semua notifikasi diproses normal.</p>
          ) : (
            <ul className="mt-3 flex flex-col">
              {problems.map((ev) => (
                <li key={ev.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-stone py-2.5 text-sm last:border-0">
                  <span className="flex flex-col">
                    <span className="font-mono text-xs text-graphite">{ev.order_id ?? "tanpa nomor"}</span>
                    <span className="text-smoke">
                      {ev.signature_valid ? paymentEventLabel(ev.result) : "Tanda tangan notifikasi tidak valid"}
                      {ev.transaction_status && ` · status ${ev.transaction_status}`}
                    </span>
                  </span>
                  <span className="text-xs text-smoke">
                    {formatDate(ev.created_at)}, {formatTime(ev.created_at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {rows.length === 0 ? (
        <Card>
          <p className="text-sm text-smoke">Belum ada tagihan dengan status ini.</p>
        </Card>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((inv) => {
            const overdue = isOverdue(inv.status, inv.due_at);
            return (
              <li key={inv.id}>
                <Card className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <Link
                      href={`/admin/usaha/${inv.company_id}`}
                      className="truncate font-medium text-ink underline-offset-4 hover:underline"
                    >
                      {inv.companies?.name ?? "Tanpa nama"}
                    </Link>
                    <span className="text-sm text-smoke">
                      {planName(inv.plan_code)} {label(CYCLE_LABEL, inv.billing_cycle).toLowerCase()} ·{" "}
                      {label(INVOICE_KIND_LABEL, inv.kind)}
                      {inv.payment_method && ` · ${inv.payment_method}`}
                    </span>
                    <span className="font-mono text-xs text-ash">
                      {inv.number} · dibuat {formatDate(inv.created_at)}
                      {inv.paid_at && ` · lunas ${formatDate(inv.paid_at)}`}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 sm:flex-col sm:items-end">
                    <span className="font-mono text-base text-ink">{formatRupiah(inv.amount)}</span>
                    <span className="flex gap-1.5">
                      {overdue && <Tag tone="ink">Lewat jatuh tempo</Tag>}
                      <Tag tone={inv.status === "paid" ? "accent" : "outline"}>{label(INVOICE_STATUS_LABEL, inv.status)}</Tag>
                    </span>
                    {(inv.discount_amount > 0 || inv.credit_amount > 0) && (
                      <span className="text-xs text-smoke">
                        {inv.discount_amount > 0 && `diskon ${formatRupiah(inv.discount_amount)}`}
                        {inv.discount_amount > 0 && inv.credit_amount > 0 && " · "}
                        {inv.credit_amount > 0 && `prorata ${formatRupiah(inv.credit_amount)}`}
                      </span>
                    )}
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <Pagination page={page} total={total} pageSize={PAGE_SIZE} hrefFor={(p) => tabHref(tab, p)} />

      <p className="text-xs text-ash">
        Pengingat tagihan otomatis belum aktif (belum ada layanan email). Hubungi owner lewat WhatsApp dari halaman detail
        usaha.
      </p>
    </>
  );
}
