import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { runPhotoCleanupJob } from "@/lib/attendance/photo-cleanup-server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function digest(value: string) {
  return createHash("sha256").update(value).digest();
}

function isAuthorized(request: NextRequest, secret: string) {
  const header = request.headers.get("authorization") ?? "";
  return timingSafeEqual(digest(header), digest(`Bearer ${secret}`));
}

/**
 * Hapus otomatis foto absen sesuai masa simpan paket. Dipanggil sekali sehari
 * oleh Vercel Cron (vercel.json) dengan header Authorization: Bearer CRON_SECRET.
 * Di VPS: panggil dari crontab dengan header yang sama.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 32) {
    console.error("[hapus foto] CRON_SECRET belum diisi atau kurang dari 32 karakter");
    return NextResponse.json({ error: "Job belum diatur." }, { status: 503 });
  }
  if (!isAuthorized(request, secret)) {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 401 });
  }

  try {
    const result = await runPhotoCleanupJob();
    if (result.skipped) {
      return NextResponse.json({ skipped: true, message: "Masih ada jalan lain yang berjalan." }, { status: 409 });
    }
    console.info(
      `[hapus foto] jalan ${result.runId} ${result.status}: ${result.photosDeleted} foto dari ${result.companies.size} usaha, ${result.failed} gagal`,
    );
    return NextResponse.json(
      {
        runId: result.runId,
        status: result.status,
        photosDeleted: result.photosDeleted,
        attendancesCleared: result.attendancesCleared,
        companies: result.companies.size,
        failed: result.failed,
      },
      { status: result.status === "gagal" ? 500 : 200 },
    );
  } catch (e) {
    console.error("[hapus foto] gagal memulai", e);
    return NextResponse.json({ error: "Gagal menjalankan job." }, { status: 500 });
  }
}
