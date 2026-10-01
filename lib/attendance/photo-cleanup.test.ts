import { describe, expect, it } from "vitest";
import {
  cleanupStatus,
  isOwnPath,
  partitionBatch,
  runPhotoCleanup,
  type CleanupCandidate,
  type CleanupDeps,
  type CleanupResult,
} from "./photo-cleanup";

const A = "aaaaaaaa-0000-0000-0000-000000000001";
const B = "bbbbbbbb-0000-0000-0000-000000000002";

function row(id: string, company: string, paths: [string | null, string | null]): CleanupCandidate {
  return { id, company_id: company, clock_in_photo_path: paths[0], clock_out_photo_path: paths[1] };
}

/** Database + storage palsu: kandidat hilang setelah ditandai, seperti RPC asli. */
function fakeDeps(rows: CleanupCandidate[], opts: { failRemove?: (paths: string[]) => boolean; running?: boolean } = {}) {
  const pending = new Map(rows.map((r) => [r.id, r]));
  const files = new Set(rows.flatMap((r) => [r.clock_in_photo_path, r.clock_out_photo_path]).filter(Boolean));
  const finished: CleanupResult[] = [];
  let clock = 0;
  const deps: CleanupDeps = {
    now: () => clock,
    closeStaleRuns: async () => {},
    startRun: async () => (opts.running ? null : 1),
    candidates: async (limit, exclude) => {
      clock += 1;
      return [...pending.values()].filter((r) => !exclude.includes(r.id)).slice(0, limit);
    },
    removeFiles: async (paths) => {
      if (opts.failRemove?.(paths)) return false;
      paths.forEach((p) => files.delete(p));
      return true;
    },
    markDeleted: async (ids) => ids.filter((id) => pending.delete(id)),
    finishRun: async (_id, result) => {
      finished.push(result);
    },
  };
  return { deps, pending, files, finished, tick: (ms: number) => (clock += ms) };
}

describe("isOwnPath", () => {
  const r = row("1", A, [null, null]);
  it("hanya path di folder usaha sendiri", () => {
    expect(isOwnPath(r, `${A}/emp/in.jpg`)).toBe(true);
    expect(isOwnPath(r, `${B}/emp/in.jpg`)).toBe(false);
    expect(isOwnPath(r, `${A}/../${B}/in.jpg`)).toBe(false);
    expect(isOwnPath(r, `x${A}/emp/in.jpg`)).toBe(false);
  });
});

describe("partitionBatch", () => {
  it("memisahkan path asing dan mengumpulkan path foto", () => {
    const ok = row("1", A, [`${A}/e/in.jpg`, `${A}/e/out.jpg`]);
    const onlyIn = row("2", A, [`${A}/e/in2.jpg`, null]);
    const foreign = row("3", A, [`${A}/e/in3.jpg`, `${B}/e/out3.jpg`]);
    const { valid, invalid, paths } = partitionBatch([ok, onlyIn, foreign]);
    expect(valid.map((r) => r.id)).toEqual(["1", "2"]);
    expect(invalid.map((r) => r.id)).toEqual(["3"]);
    expect(paths).toEqual([`${A}/e/in.jpg`, `${A}/e/out.jpg`, `${A}/e/in2.jpg`]);
  });
});

describe("cleanupStatus", () => {
  it("selesai hanya kalau semua kandidat habis tanpa gagal", () => {
    expect(cleanupStatus(true, 0)).toBe("selesai");
    expect(cleanupStatus(true, 2)).toBe("sebagian");
    expect(cleanupStatus(false, 0)).toBe("sebagian");
  });
});

describe("runPhotoCleanup", () => {
  const rows = [
    row("1", A, [`${A}/e/1-in.jpg`, `${A}/e/1-out.jpg`]),
    row("2", A, [`${A}/e/2-in.jpg`, null]),
    row("3", B, [`${B}/e/3-in.jpg`, `${B}/e/3-out.jpg`]),
  ];

  it("menghapus file, menandai absen, dan menghitung per usaha", async () => {
    const f = fakeDeps(rows);
    const result = await runPhotoCleanup(f.deps, { batchSize: 2 });
    expect(result.skipped).toBe(false);
    if (result.skipped) return;
    expect(result.status).toBe("selesai");
    expect(result.photosDeleted).toBe(5);
    expect(result.attendancesCleared).toBe(3);
    expect(result.companies.get(A)).toEqual({ photosDeleted: 3, attendancesCleared: 2, failed: 0 });
    expect(result.companies.get(B)).toEqual({ photosDeleted: 2, attendancesCleared: 1, failed: 0 });
    expect(f.files.size).toBe(0);
    expect(f.pending.size).toBe(0);
    expect(f.finished).toHaveLength(1);
  });

  it("aman diulang: jalan kedua tidak menghapus apa-apa", async () => {
    const f = fakeDeps(rows);
    await runPhotoCleanup(f.deps);
    const again = await runPhotoCleanup(f.deps);
    if (again.skipped) throw new Error("tidak boleh dilewati");
    expect(again.status).toBe("selesai");
    expect(again.photosDeleted).toBe(0);
    expect(again.companies.size).toBe(0);
  });

  it("storage gagal: absen tidak ditandai, dicatat gagal, jalan tetap berhenti", async () => {
    const f = fakeDeps(rows, { failRemove: (paths) => paths.some((p) => p.startsWith(B)) });
    const result = await runPhotoCleanup(f.deps, { batchSize: 1 });
    if (result.skipped) throw new Error("tidak boleh dilewati");
    expect(result.status).toBe("sebagian");
    expect(result.failed).toBe(1);
    expect(result.companies.get(B)).toEqual({ photosDeleted: 0, attendancesCleared: 0, failed: 1 });
    expect([...f.pending.keys()]).toEqual(["3"]);
  });

  it("path di luar folder usaha tidak pernah dihapus", async () => {
    const bad = row("9", A, [`${B}/e/curian.jpg`, null]);
    const f = fakeDeps([bad]);
    const result = await runPhotoCleanup(f.deps);
    if (result.skipped) throw new Error("tidak boleh dilewati");
    expect(result.failed).toBe(1);
    expect(f.files.has(`${B}/e/curian.jpg`)).toBe(true);
  });

  it("berhenti saat waktu habis dan menandai sebagian", async () => {
    const f = fakeDeps(rows);
    const removeFiles = f.deps.removeFiles;
    f.deps.removeFiles = async (paths) => {
      f.tick(1000);
      return removeFiles(paths);
    };
    const result = await runPhotoCleanup(f.deps, { batchSize: 1, budgetMs: 1500 });
    if (result.skipped) throw new Error("tidak boleh dilewati");
    expect(result.status).toBe("sebagian");
    expect(result.attendancesCleared).toBe(2);
    expect(f.pending.size).toBe(1);
  });

  it("dilewati kalau ada jalan lain yang masih berjalan", async () => {
    const f = fakeDeps(rows, { running: true });
    expect(await runPhotoCleanup(f.deps)).toEqual({ skipped: true });
    expect(f.files.size).toBe(5);
  });

  it("error database: status gagal dan ringkasan tetap disimpan", async () => {
    const f = fakeDeps(rows);
    f.deps.markDeleted = async () => {
      throw new Error("koneksi putus");
    };
    const result = await runPhotoCleanup(f.deps);
    if (result.skipped) throw new Error("tidak boleh dilewati");
    expect(result.status).toBe("gagal");
    expect(result.error).toBe("koneksi putus");
    expect(f.finished[0]?.status).toBe("gagal");
  });
});
