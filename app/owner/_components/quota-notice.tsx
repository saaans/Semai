import { ButtonLink } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Tag } from "@/components/ui/tag";
import type { BillingOverview } from "@/lib/billing/server";
import { addDays, OVER_LIMIT_GRACE_DAYS, quotaStatus, shouldWarnQuota } from "@/lib/billing/state";
import { formatDate } from "@/lib/format";

type Notice = { tag: string; title: string; description: string };

function noticeFor(overview: BillingOverview, timezone: string): Notice | null {
  const { employeesUsed: used, employeeLimit: limit, planName } = overview;
  const quota = quotaStatus(used, limit);
  if (!shouldWarnQuota(quota) || limit === null) return null;

  if (overview.hiddenCount > 0) {
    return {
      tag: "Melewati batas",
      title: `${overview.hiddenCount} karyawan disembunyikan`,
      description: `Paket ${planName} untuk maksimal ${limit} karyawan. Karyawan yang paling baru ditambahkan disembunyikan dari dashboard dan gajian. Data mereka tidak dihapus dan mereka tetap bisa absen. Upgrade paket, atau nonaktifkan karyawan lain supaya mereka muncul lagi.`,
    };
  }
  if (quota.tone === "lewat") {
    const hideAt = overview.overLimitSince ? addDays(overview.overLimitSince, OVER_LIMIT_GRACE_DAYS) : null;
    return {
      tag: quota.text,
      title: `Karyawan melewati batas paket ${planName}`,
      description: `${hideAt ? `Mulai ${formatDate(hideAt, timezone)}, ` : "Setelah 14 hari, "}${used - limit} karyawan yang paling baru ditambahkan disembunyikan dari dashboard dan gajian. Data tidak dihapus dan absen tetap jalan. Upgrade paket, atau nonaktifkan karyawan yang sudah tidak bekerja.`,
    };
  }
  if (quota.tone === "penuh") {
    return {
      tag: quota.text,
      title: "Kuota karyawan penuh",
      description: `Paket ${planName} untuk maksimal ${limit} karyawan (aktif dan yang masih diundang). Upgrade untuk menambah karyawan baru. Absen karyawan yang ada tetap jalan.`,
    };
  }
  return {
    tag: quota.text,
    title: "Sisa 1 kursi karyawan",
    description: `Paket ${planName} untuk maksimal ${limit} karyawan. Upgrade sebelum penuh supaya kamu tetap bisa menambah karyawan.`,
  };
}

/**
 * Peringatan kuota karyawan ("4 dari 5 karyawan terpakai"), muncul saat sisa
 * kursi tinggal satu atau kurang. Satu-satunya ajakan upgrade di halamannya.
 */
export function QuotaNotice({
  overview,
  timezone,
  dismiss,
}: {
  overview: BillingOverview;
  timezone: string;
  /** Tombol tutup (dashboard). */
  dismiss?: React.ReactNode;
}) {
  const notice = noticeFor(overview, timezone);
  if (!notice) return null;
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <Tag tone="accent">{notice.tag}</Tag>
        {dismiss}
      </div>
      <CardTitle className="mt-3">{notice.title}</CardTitle>
      <CardDescription>{notice.description}</CardDescription>
      <div className="mt-4">
        <ButtonLink href="/owner/paket" variant="secondary">
          Lihat paket
        </ButtonLink>
      </div>
    </Card>
  );
}
