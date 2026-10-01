import Link from "next/link";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { KehadiranBar } from "@/components/kehadiran-bar";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Tag } from "@/components/ui/tag";
import { getTodayBoard, type TodayEntry } from "@/lib/attendance/owner";
import { dayLabel } from "@/lib/attendance/recap";
import { requireOwner } from "@/lib/auth/session";
import { getBillingOverview } from "@/lib/billing/server";
import { QUOTA_DISMISS_COOKIE } from "@/lib/billing/state";
import { getRemoteStatus } from "@/lib/employees/remote";
import { formatDate, formatMinutes, formatTime, timezoneLabel } from "@/lib/format";
import { parseProgress } from "@/lib/onboarding/data";
import { cn } from "@/lib/cn";
import { createClient } from "@/lib/supabase/server";
import { formatDistance, koreksiInitial, STATUS_LABEL } from "./_components/absen-info";
import { AbsenPhoto } from "./_components/absen-photo";
import { AutoRefresh } from "./_components/auto-refresh";
import { KoreksiButton } from "./_components/koreksi-button";
import { LemburActions } from "./_components/lembur-actions";
import { QuotaNotice } from "./_components/quota-notice";
import { TutupKuotaButton } from "./paket/paket-forms";

export const metadata: Metadata = { title: "Hari ini" };

export default async function OwnerPage() {
  const owner = await requireOwner();
  if (!owner.onboardingCompleted) redirect("/owner/onboarding");

  const [board, pendingPlan, remote, overview, cookieStore] = await Promise.all([
    getTodayBoard(owner.companyId),
    getPendingPaidPlan(owner.companyId),
    getRemoteStatus(owner.companyId),
    getBillingOverview(owner.companyId).catch(() => null),
    cookies(),
  ]);
  const quotaDismissed = cookieStore.get(QUOTA_DISMISS_COOKIE)?.value === "1";
  const remoteCount = board.entries.filter((e) => e.isRemote).length;
  const tz = board.timezone;

  const total = board.entries.length;
  const kehadiran = {
    tepat: board.summary.masuk - board.summary.telat,
    telat: board.summary.telat,
    izin: board.summary.izin,
    lainnya: total - board.summary.masuk - board.summary.izin - board.summary.belum,
    belum: board.summary.belum,
  };
  const lewatJam = board.entries.filter((e) => e.status === "belum" && e.pastStart).length;

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <p className="text-sm text-smoke">
            {formatDate(board.updatedAt, tz)} · {timezoneLabel(tz)}
          </p>
          <h1 className="text-3xl sm:text-4xl">Hari ini</h1>
          <AutoRefresh updatedAt={board.updatedAt} />
        </div>
        <div className="flex gap-2">
          <ButtonLink href="/owner/absen" variant="secondary">
            Rekap bulanan
          </ButtonLink>
          <ButtonLink href="/owner/karyawan/tambah" variant="secondary">
            Tambah karyawan
          </ButtonLink>
        </div>
      </div>

      {total > 0 && (
        <Card className="flex flex-col gap-5">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <p className="text-lg text-ink">
              <span className="font-medium tabular-nums">{board.summary.masuk}</span>
              <span className="text-smoke"> dari </span>
              <span className="font-medium tabular-nums">{total}</span>
              <span className="text-smoke"> karyawan sudah absen</span>
            </p>
            {lewatJam > 0 && (
              <p className="text-sm text-graphite">{lewatJam} orang lewat jam masuk, belum absen</p>
            )}
          </div>
          <KehadiranBar data={kehadiran} legend="grid" className="gap-5" />
        </Card>
      )}

      {board.pendingOvertime.length > 0 && (
        <Card className="flex flex-col gap-4">
          <div>
            <CardTitle>Lembur menunggu persetujuan</CardTitle>
            <CardDescription>Hanya lembur yang disetujui yang masuk gajian.</CardDescription>
          </div>
          <ul className="flex flex-col divide-y divide-stone">
            {board.pendingOvertime.map((item) => (
              <li key={item.id} className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <Link href={`/owner/absen/${item.employeeId}?bulan=${item.workDate.slice(0, 7)}`} className="font-medium text-ink underline-offset-4 hover:underline">
                    {item.name}
                  </Link>
                  <p className="text-sm text-smoke">
                    {dayLabel(item.workDate)} · {formatMinutes(item.overtimeMinutes)}
                    {item.clockOutAt ? ` · pulang ${formatTime(item.clockOutAt, tz)}` : ""}
                  </p>
                </div>
                <LemburActions attendanceId={item.id} />
              </li>
            ))}
          </ul>
        </Card>
      )}

      {remoteCount > 0 && (remote.graceUntil || !remote.allowed) && (
        <Card>
          <Tag tone="outline">Absen remote</Tag>
          <CardTitle className="mt-3">
            {remote.graceUntil
              ? `Absen remote berakhir ${formatDate(remote.graceUntil, tz)}`
              : "Absen remote tidak berlaku"}
          </CardTitle>
          <CardDescription>
            {remoteCount} karyawan ditandai kerja remote, tapi paket usaha sekarang Benih.{" "}
            {remote.graceUntil
              ? "Setelah tanggal itu mereka wajib absen dalam radius lokasi. Atur lokasi absen mereka, atau upgrade ke paket berbayar supaya tetap bisa absen dari mana saja."
              : "Mereka sekarang wajib absen dalam radius lokasi. Pastikan lokasi absen mereka sudah diatur."}
          </CardDescription>
        </Card>
      )}

      {overview && !quotaDismissed && <QuotaNotice overview={overview} timezone={tz} dismiss={<TutupKuotaButton />} />}

      {pendingPlan && (
        <Card>
          <Tag tone="outline">Menunggu pembayaran</Tag>
          <CardTitle className="mt-3">Selesaikan pembayaran {pendingPlan}</CardTitle>
          <CardDescription>
            Pembayaran online segera tersedia. Sementara itu usahamu memakai paket Benih, dan absen
            karyawan tetap jalan seperti biasa.
          </CardDescription>
        </Card>
      )}

      {board.entries.length === 0 ? (
        <Card>
          <CardTitle>Belum ada karyawan aktif</CardTitle>
          <CardDescription>
            Tambah karyawan dan kirim link undangan lewat WA. Setelah karyawan aktivasi, absennya
            tampil di sini.
          </CardDescription>
          <div className="mt-4">
            <ButtonLink href="/owner/karyawan/tambah">Tambah karyawan</ButtonLink>
          </div>
        </Card>
      ) : (
        <section className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-2xl">Absen karyawan</h2>
            <span className="text-sm text-smoke tabular-nums">{total} orang</span>
          </div>
          <Card className="p-0 sm:p-0">
            <EntryHeader />
            <ul className="flex flex-col divide-y divide-stone md:border-t md:border-stone">
              {board.entries.map((entry) => (
                <EntryRow key={entry.employeeId} entry={entry} timezone={tz} showClockOut={board.attendanceMode === "masuk_pulang"} today={board.today} />
              ))}
            </ul>
          </Card>
        </section>
      )}
    </>
  );
}

function EntryTag({ entry }: { entry: TodayEntry }) {
  switch (entry.status) {
    case "masuk":
      return <Tag>Masuk</Tag>;
    case "telat":
      return <Tag tone="accent">Telat {formatMinutes(entry.attendance?.lateMinutes ?? 0)}</Tag>;
    case "izin":
      return <Tag tone="outline">{STATUS_LABEL[entry.attendance?.status ?? "izin"]}</Tag>;
    case "alpa":
      return <Tag tone="ink">Tidak masuk</Tag>;
    case "libur":
      return <Tag tone="outline">Libur</Tag>;
    case "belum":
      return entry.pastStart ? <Tag tone="ink">Belum absen</Tag> : <Tag tone="outline">Belum absen</Tag>;
  }
}

/** Kolom tabel absen di layar lebar: karyawan, masuk, pulang, status, aksi. */
const ROW_GRID = "md:grid md:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)_minmax(0,0.8fr)_10.5rem_6.5rem] md:items-center md:gap-4";

function EntryHeader() {
  return (
    <div className={cn("hidden px-6 py-3 text-xs text-ash", ROW_GRID)}>
      <span>Karyawan</span>
      <span>Masuk</span>
      <span>Pulang</span>
      <span>Status</span>
      <span className="sr-only">Aksi</span>
    </div>
  );
}

function EntryRow({
  entry,
  timezone,
  showClockOut,
  today,
}: {
  entry: TodayEntry;
  timezone: string;
  showClockOut: boolean;
  today: string;
}) {
  const a = entry.attendance;
  const hadir = a?.status === "hadir";
  const meta = [
    entry.isRemote ? "Remote" : null,
    entry.position,
    entry.workDate !== today ? `Shift ${dayLabel(entry.workDate)}` : null,
    entry.status === "belum" && entry.scheduleStart ? `Jadwal masuk ${entry.scheduleStart}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  // Catatan yang belum terlihat di kolom lain (telat sudah ada di status).
  const notes: string[] = [];
  if (a && hadir) {
    if (a.earlyLeaveMinutes > 0) notes.push(`Pulang cepat ${formatMinutes(a.earlyLeaveMinutes)}`);
    if (a.overtimeMinutes > 0) {
      const status = a.overtimeStatus === "disetujui" ? "disetujui" : a.overtimeStatus === "ditolak" ? "ditolak" : "menunggu persetujuan";
      notes.push(`Lembur ${formatMinutes(a.overtimeMinutes)} (${status})`);
    }
    if (a.offline) notes.push("Dikirim saat offline");
  }
  if (a?.correctionReason) notes.push(`Dikoreksi: ${a.correctionReason}`);

  const distance = (meters: number | null) => {
    if (meters === null) return entry.isRemote ? "Absen remote" : null;
    return `${formatDistance(meters)} dari lokasi`;
  };
  const clockIn = hadir && a?.clockInAt ? formatTime(a.clockInAt, timezone) : null;
  const clockOut = hadir && a?.clockOutAt ? formatTime(a.clockOutAt, timezone) : null;
  const showPhoto = hadir && a && !a.photosDeleted && a.clockInAt && a.clockInPhotoUrl;

  return (
    <li className={cn("flex flex-col gap-3 px-4 py-4 md:px-6", ROW_GRID)}>
      {/* Karyawan */}
      <div className="flex min-w-0 items-center gap-3">
        {showPhoto ? (
          <AbsenPhoto url={a.clockInPhotoUrl} alt={`Foto masuk ${entry.name}`} label="Masuk" size="sm" />
        ) : (
          <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full border border-stone bg-canvas text-sm font-medium text-graphite">
            {entry.name.trim().charAt(0).toUpperCase() || "?"}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <Link href={`/owner/absen/${entry.employeeId}`} className="block truncate font-medium text-ink underline-offset-4 hover:underline">
            {entry.name}
          </Link>
          {meta && <p className="truncate text-sm text-smoke">{meta}</p>}
        </div>
        <span className="shrink-0 md:hidden">
          <EntryTag entry={entry} />
        </span>
      </div>

      {/* HP: jam masuk dan pulang satu baris, aksi di kanan */}
      <div className="flex items-center justify-between gap-3 pl-[3.25rem] text-sm md:hidden">
        <span className="min-w-0 truncate text-smoke">
          {hadir && (
            <>
              Masuk <span className="font-mono text-ink">{clockIn ?? "–"}</span>
              {(showClockOut || clockOut) && (
                <>
                  {"  ·  "}Pulang <span className="font-mono text-ink">{clockOut ?? "–"}</span>
                </>
              )}
            </>
          )}
        </span>
        <span className="-my-2 shrink-0">
          <KoreksiCell entry={entry} timezone={timezone} showClockOut={showClockOut} />
        </span>
      </div>

      {/* Layar lebar: kolom terpisah */}
      <div className="hidden min-w-0 md:block">
        <p className="font-mono text-sm text-ink">{clockIn ?? "–"}</p>
        {clockIn && distance(a?.clockInDistanceM ?? null) && (
          <p className="truncate text-xs text-smoke">{distance(a?.clockInDistanceM ?? null)}</p>
        )}
      </div>
      <div className="hidden min-w-0 md:block">
        <p className="font-mono text-sm text-ink">{clockOut ?? "–"}</p>
        {clockOut && distance(a?.clockOutDistanceM ?? null) && (
          <p className="truncate text-xs text-smoke">{distance(a?.clockOutDistanceM ?? null)}</p>
        )}
      </div>
      <div className="hidden md:block">
        <EntryTag entry={entry} />
      </div>
      <div className="-my-2 hidden justify-end md:flex">
        <KoreksiCell entry={entry} timezone={timezone} showClockOut={showClockOut} />
      </div>

      {notes.length > 0 && (
        <p className="pl-[3.25rem] text-xs text-smoke md:col-span-full md:-mt-2">{notes.join(" · ")}</p>
      )}
    </li>
  );
}

function KoreksiCell({ entry, timezone, showClockOut }: { entry: TodayEntry; timezone: string; showClockOut: boolean }) {
  return (
    <KoreksiButton
      employeeId={entry.employeeId}
      employeeName={entry.name}
      workDate={entry.workDate}
      dateLabel={dayLabel(entry.workDate)}
      initial={koreksiInitial(entry.attendance, timezone)}
      showClockOut={showClockOut || Boolean(entry.attendance?.clockOutAt)}
      label={entry.attendance ? "Koreksi" : "Catat manual"}
    />
  );
}

/** Paket berbayar yang dipilih saat onboarding tapi belum aktif. */
async function getPendingPaidPlan(companyId: string): Promise<string | null> {
  const supabase = await createClient();
  const [{ data: company }, { data: level }] = await Promise.all([
    supabase.from("companies").select("onboarding").eq("id", companyId).maybeSingle(),
    supabase.rpc("company_level", { p_company_id: companyId }),
  ]);
  const progress = parseProgress(company?.onboarding);
  if (progress.plan_choice !== "berbayar" || !progress.plan_code || level !== "benih") return null;

  const { data: plan } = await supabase
    .from("plans")
    .select("name")
    .eq("code", progress.plan_code)
    .maybeSingle();
  return plan?.name ?? null;
}
