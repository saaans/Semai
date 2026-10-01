import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Tag } from "@/components/ui/tag";
import { getPhotoCleanupRunDetail, listPhotoCleanupRuns } from "@/lib/admin/server";
import { cn } from "@/lib/cn";
import { formatDate, formatTime } from "@/lib/format";

export const metadata: Metadata = { title: "Hapus foto" };

const STATUS_LABEL: Record<string, string> = {
  berjalan: "Berjalan",
  selesai: "Selesai",
  sebagian: "Sebagian",
  gagal: "Gagal",
};

const STATUS_TONE: Record<string, "accent" | "ink" | "outline" | "neutral"> = {
  berjalan: "neutral",
  selesai: "accent",
  sebagian: "outline",
  gagal: "ink",
};

function count(n: number) {
  return n.toLocaleString("id-ID");
}

export default async function HapusFotoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const runs = await listPhotoCleanupRuns();
  const requested = Number(params.jalan);
  const selected = runs.find((r) => r.id === requested) ?? runs[0] ?? null;
  const detail = selected ? await getPhotoCleanupRunDetail(selected.id) : [];

  return (
    <>
      <div>
        <h1 className="text-3xl sm:text-4xl">Hapus foto</h1>
        <p className="mt-1 text-sm text-smoke">
          Job harian yang menghapus foto absen sesuai masa simpan paket. Data absen (jam, status, telat, lembur) tetap
          disimpan.
        </p>
      </div>

      {runs.length === 0 ? (
        <Card>
          <p className="text-sm text-smoke">Job belum pernah jalan. Pastikan CRON_SECRET sudah diisi di server.</p>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <section aria-label="Riwayat jalan" className="flex flex-col gap-2">
            <h2 className="text-sm font-medium text-graphite">30 jalan terakhir</h2>
            <ul className="flex flex-col gap-2">
              {runs.map((run) => (
                <li key={run.id}>
                  <Link
                    href={`/admin/foto?jalan=${run.id}`}
                    aria-current={run.id === selected?.id ? "page" : undefined}
                    className={cn(
                      "flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-card border p-4 text-sm",
                      run.id === selected?.id ? "border-ink bg-taupe" : "border-stone hover:border-graphite",
                    )}
                  >
                    <span className="flex flex-col">
                      <span className="font-medium text-ink">
                        {formatDate(run.started_at)}, {formatTime(run.started_at)}
                      </span>
                      <span className="text-smoke">
                        {count(run.photos_deleted)} foto · {count(run.companies_count)} usaha
                        {run.failed_count > 0 && ` · ${count(run.failed_count)} gagal`}
                      </span>
                    </span>
                    <Tag tone={STATUS_TONE[run.status] ?? "outline"}>{STATUS_LABEL[run.status] ?? run.status}</Tag>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          {selected && (
            <Card className="flex flex-col gap-3 self-start">
              <div>
                <CardTitle>
                  Jalan {formatDate(selected.started_at)}, {formatTime(selected.started_at)}
                </CardTitle>
                <CardDescription>
                  {count(selected.photos_deleted)} foto dari {count(selected.attendances_cleared)} absen
                  {selected.finished_at && ` · selesai ${formatTime(selected.finished_at)}`}
                </CardDescription>
              </div>
              {selected.status === "sebagian" && (
                <p className="text-sm text-smoke">
                  Belum semua foto lewat masa simpan terhapus (waktu habis atau ada yang gagal). Sisanya dilanjut di jalan
                  berikutnya.
                </p>
              )}
              {selected.error && <p className="font-mono text-xs text-graphite">{selected.error}</p>}
              {detail.length === 0 ? (
                <p className="text-sm text-smoke">Tidak ada foto yang perlu dihapus di jalan ini.</p>
              ) : (
                <ul className="flex flex-col">
                  {detail.map((row) => (
                    <li
                      key={row.company_id}
                      className="flex items-baseline justify-between gap-4 border-b border-stone py-2.5 text-sm last:border-0"
                    >
                      <Link
                        href={`/admin/usaha/${row.company_id}`}
                        className="min-w-0 truncate text-ink underline-offset-4 hover:underline"
                      >
                        {row.company_name}
                      </Link>
                      <span className="shrink-0 font-mono text-graphite">
                        {count(row.photos_deleted)} foto
                        {row.failed_count > 0 && <span className="text-smoke"> · {count(row.failed_count)} gagal</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}
        </div>
      )}
    </>
  );
}
