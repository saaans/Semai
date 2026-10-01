/**
 * Hapus otomatis foto absen sesuai masa simpan paket.
 *
 * Masa simpan dan kandidat diputuskan database (photo_cleanup_candidates).
 * Di sini: hapus file lewat Storage API, lalu tandai absennya
 * (mark_photos_deleted). Urutan ini membuat job aman diulang: kalau mati di
 * tengah, jalan berikutnya menghapus ulang file yang sudah tidak ada (tanpa
 * efek) lalu menandai absennya.
 *
 * Logika dipisah dari Supabase lewat CleanupDeps supaya bisa dites.
 */

export type CleanupCandidate = {
  id: string;
  company_id: string;
  clock_in_photo_path: string | null;
  clock_out_photo_path: string | null;
};

export type CompanyTally = {
  photosDeleted: number;
  attendancesCleared: number;
  failed: number;
};

export type CleanupStatus = "selesai" | "sebagian" | "gagal";

export type CleanupResult = {
  status: CleanupStatus;
  photosDeleted: number;
  attendancesCleared: number;
  failed: number;
  companies: Map<string, CompanyTally>;
  error: string | null;
};

export type CleanupDeps = {
  /** Tandai gagal jalan yang masih "berjalan" tapi dimulai sebelum `before`. */
  closeStaleRuns(before: Date): Promise<void>;
  /** Mulai jalan baru. null = masih ada jalan lain yang berjalan. */
  startRun(): Promise<number | null>;
  candidates(limit: number, exclude: string[]): Promise<CleanupCandidate[]>;
  /** Hapus file di bucket foto absen. false = gagal (dicoba lagi besok). */
  removeFiles(paths: string[]): Promise<boolean>;
  /** Id absen yang benar-benar ditandai (yang sudah ditandai dilewati). */
  markDeleted(ids: string[]): Promise<string[]>;
  finishRun(runId: number, result: CleanupResult): Promise<void>;
  now(): number;
};

export const CLEANUP_BATCH_SIZE = 200;
/** Batas waktu satu jalan; sisa kandidat dilanjut besok. */
export const CLEANUP_BUDGET_MS = 45_000;
/** Jalan yang "berjalan" lebih lama dari ini dianggap terhenti. */
export const STALE_RUN_MS = 15 * 60_000;

export function photoPaths(row: CleanupCandidate): string[] {
  return [row.clock_in_photo_path, row.clock_out_photo_path].filter((p): p is string => Boolean(p));
}

/** Pengaman: hanya hapus file di folder usaha pemilik absen. */
export function isOwnPath(row: CleanupCandidate, path: string): boolean {
  return path.startsWith(`${row.company_id}/`) && !path.split("/").includes("..");
}

/** Pisahkan baris yang semua path fotonya aman dihapus dari yang tidak. */
export function partitionBatch(rows: CleanupCandidate[]): {
  valid: CleanupCandidate[];
  invalid: CleanupCandidate[];
  paths: string[];
} {
  const valid: CleanupCandidate[] = [];
  const invalid: CleanupCandidate[] = [];
  for (const row of rows) {
    const paths = photoPaths(row);
    if (paths.length > 0 && paths.every((p) => isOwnPath(row, p))) valid.push(row);
    else invalid.push(row);
  }
  return { valid, invalid, paths: valid.flatMap(photoPaths) };
}

function tally(companies: Map<string, CompanyTally>, companyId: string): CompanyTally {
  let t = companies.get(companyId);
  if (!t) {
    t = { photosDeleted: 0, attendancesCleared: 0, failed: 0 };
    companies.set(companyId, t);
  }
  return t;
}

export function cleanupStatus(done: boolean, failed: number): CleanupStatus {
  return done && failed === 0 ? "selesai" : "sebagian";
}

export async function runPhotoCleanup(
  deps: CleanupDeps,
  { batchSize = CLEANUP_BATCH_SIZE, budgetMs = CLEANUP_BUDGET_MS } = {},
): Promise<{ skipped: true } | ({ skipped: false; runId: number } & CleanupResult)> {
  const startedAt = deps.now();
  await deps.closeStaleRuns(new Date(startedAt - STALE_RUN_MS));
  const runId = await deps.startRun();
  if (runId === null) return { skipped: true };

  const companies = new Map<string, CompanyTally>();
  const exclude: string[] = [];
  let photosDeleted = 0;
  let attendancesCleared = 0;
  let failed = 0;
  let done = false;
  let error: string | null = null;

  const fail = (row: CleanupCandidate) => {
    exclude.push(row.id);
    tally(companies, row.company_id).failed += 1;
    failed += 1;
  };

  try {
    while (deps.now() - startedAt < budgetMs) {
      const rows = await deps.candidates(batchSize, exclude);
      if (rows.length === 0) {
        done = true;
        break;
      }

      const { valid, invalid, paths } = partitionBatch(rows);
      invalid.forEach(fail);
      if (valid.length === 0) continue;

      if (!(await deps.removeFiles(paths))) {
        valid.forEach(fail);
        continue;
      }

      const marked = new Set(await deps.markDeleted(valid.map((r) => r.id)));
      for (const row of valid) {
        if (!marked.has(row.id)) continue;
        const t = tally(companies, row.company_id);
        const count = photoPaths(row).length;
        t.photosDeleted += count;
        t.attendancesCleared += 1;
        photosDeleted += count;
        attendancesCleared += 1;
      }
    }
  } catch (e) {
    console.error("[hapus foto] jalan terhenti", e);
    error = e instanceof Error ? e.message : "Kesalahan tidak dikenal";
  }

  const result: CleanupResult = {
    status: error ? "gagal" : cleanupStatus(done, failed),
    photosDeleted,
    attendancesCleared,
    failed,
    companies,
    error,
  };
  await deps.finishRun(runId, result);
  return { skipped: false, runId, ...result };
}
