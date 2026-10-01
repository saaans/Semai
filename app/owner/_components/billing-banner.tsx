import Link from "next/link";
import type { BillingOverview } from "@/lib/billing/server";
import { addDays, daysLeft, PAYMENT_GRACE_DAYS, TRIAL_WARNING_DAYS } from "@/lib/billing/state";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format";

/**
 * Status tagihan di atas semua halaman owner: baca saja, tenggang, atau trial
 * hampir habis. Hanya pemberitahuan dengan tautan ke Paket, bukan ajakan
 * upgrade, dan tidak pernah muncul di area karyawan.
 */
export function BillingBanner({ overview, timezone }: { overview: BillingOverview; timezone: string }) {
  let text: string | null = null;
  let strong = false;

  if (overview.state === "baca_saja" && overview.currentPeriodEnd) {
    strong = true;
    text = `Tagihan paket ${overview.planName} belum dibayar sejak ${formatDate(overview.currentPeriodEnd, timezone)}. Data hanya bisa dilihat sampai tagihan dibayar atau kamu pindah ke Benih. Absen karyawan tetap jalan.`;
  } else if (overview.state === "tenggang" && overview.currentPeriodEnd) {
    const readOnlyAt = addDays(overview.currentPeriodEnd, PAYMENT_GRACE_DAYS);
    text = `Masa aktif paket ${overview.planName} sudah berakhir. Bayar sebelum ${formatDate(readOnlyAt, timezone)} supaya data tetap bisa diubah.`;
  } else if (overview.status === "trialing" && overview.trialEndsAt) {
    const left = daysLeft(overview.trialEndsAt);
    if (left <= TRIAL_WARNING_DAYS) {
      text = `Trial ${overview.planName} berakhir ${formatDate(overview.trialEndsAt, timezone)}${left > 0 ? ` (${left} hari lagi)` : ""}. Setelah itu usahamu pindah ke Benih, data tidak dihapus.`;
    }
  }

  if (!text) return null;
  return (
    <div
      role="status"
      className={cn(
        "flex flex-col gap-2 rounded-card border px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between",
        strong ? "border-ink bg-taupe text-ink" : "border-stone text-graphite",
      )}
    >
      <p>{text}</p>
      <Link href="/owner/paket" className="shrink-0 font-medium text-ink underline underline-offset-4">
        Buka Paket
      </Link>
    </div>
  );
}
