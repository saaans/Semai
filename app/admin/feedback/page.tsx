import type { Metadata } from "next";
import Link from "next/link";
import { LogoutButton } from "@/components/logout-button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Tag } from "@/components/ui/tag";
import { cn } from "@/lib/cn";
import { FEEDBACK_CATEGORIES, FEEDBACK_STATUSES, feedbackLabel } from "@/lib/feedback/schemas";
import { formatDate, formatTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { StatusForm } from "./status-form";

export const metadata: Metadata = { title: "Masukan · Super admin" };

const STATUS_VALUES = new Set<string>(FEEDBACK_STATUSES.map((s) => s.value));

export default async function AdminFeedbackPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status: rawStatus } = await searchParams;
  const status = rawStatus && STATUS_VALUES.has(rawStatus) ? rawStatus : null;

  const supabase = await createClient();
  const { data: feedbacks, error } = await supabase.rpc("admin_list_feedbacks", { p_status: status });
  if (error) console.error("[admin/feedback]", error);

  const filters = [{ value: null, label: "Semua" }, ...FEEDBACK_STATUSES];

  return (
    <div className="mx-auto flex min-h-dvh max-w-6xl flex-col gap-8 px-5 py-6 sm:px-8">
      <header className="flex items-center justify-between border-b border-stone pb-4">
        <Link href="/admin" className="font-display text-2xl tracking-tight">
          semai
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-sm text-smoke">Super admin</span>
          <LogoutButton />
        </div>
      </header>
      <main className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <Link href="/admin" className="text-sm text-graphite underline underline-offset-4 hover:text-ink">
            Ringkasan bisnis
          </Link>
          <h1 className="text-3xl sm:text-4xl">Masukan dari owner</h1>
        </div>

        <nav aria-label="Filter status" className="flex flex-wrap gap-2">
          {filters.map((f) => {
            const active = f.value === status;
            return (
              <Link
                key={f.label}
                href={f.value ? `/admin/feedback?status=${f.value}` : "/admin/feedback"}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-11 items-center rounded-full border px-4 text-sm",
                  active ? "border-ink bg-ink text-canvas" : "border-stone text-graphite hover:border-graphite",
                )}
              >
                {f.label}
              </Link>
            );
          })}
        </nav>

        {error ? (
          <Card>
            <CardTitle>Masukan gagal dimuat</CardTitle>
            <CardDescription>Periksa koneksi internet, lalu muat ulang halaman.</CardDescription>
          </Card>
        ) : !feedbacks?.length ? (
          <Card>
            <CardTitle>Belum ada masukan</CardTitle>
            <CardDescription>
              {status ? "Tidak ada masukan dengan status ini." : "Masukan dari tombol di dashboard owner akan muncul di sini."}
            </CardDescription>
          </Card>
        ) : (
          <ul className="flex flex-col gap-3">
            {feedbacks.map((f) => (
              <li key={f.id}>
                <Card className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                    <div className="min-w-0">
                      <p className="font-medium text-ink">{f.sender_name ?? "Tanpa nama"}</p>
                      <p className="truncate text-sm text-smoke">
                        {f.company_name ?? "Usaha tanpa nama"}
                        {f.sender_email && <> · {f.sender_email}</>}
                      </p>
                    </div>
                    <p className="text-sm text-smoke">
                      {formatDate(f.created_at)}, {formatTime(f.created_at)} WIB
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Tag tone="outline">{feedbackLabel(FEEDBACK_CATEGORIES, f.category)}</Tag>
                    {f.page_path && <span className="font-mono text-xs text-ash">{f.page_path}</span>}
                  </div>
                  <p className="text-sm whitespace-pre-wrap text-graphite">{f.message}</p>
                  <StatusForm id={f.id} status={f.status} priority={f.priority} />
                </Card>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
