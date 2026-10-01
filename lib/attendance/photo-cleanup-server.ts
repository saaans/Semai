import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { runPhotoCleanup, type CleanupDeps } from "./photo-cleanup";

const BUCKET = "absen-foto";

/** Job harian hapus foto absen dengan service role. */
export async function runPhotoCleanupJob() {
  const supabase = createAdminClient();

  const deps: CleanupDeps = {
    now: () => Date.now(),

    async closeStaleRuns(before) {
      const { error } = await supabase
        .from("photo_cleanup_runs")
        .update({ status: "gagal", finished_at: new Date().toISOString(), error: "Terhenti sebelum selesai." })
        .eq("status", "berjalan")
        .lt("started_at", before.toISOString());
      if (error) throw new Error(`Gagal merapikan jalan lama: ${error.message}`);
    },

    async startRun() {
      const { data, error } = await supabase.from("photo_cleanup_runs").insert({}).select("id").single();
      if (error?.code === "23505") return null;
      if (error) throw new Error(`Gagal mencatat jalan baru: ${error.message}`);
      return data.id;
    },

    async candidates(limit, exclude) {
      const { data, error } = await supabase.rpc("photo_cleanup_candidates", { p_limit: limit, p_exclude: exclude });
      if (error) throw new Error(`Gagal mengambil kandidat: ${error.message}`);
      return data;
    },

    async removeFiles(paths) {
      const { error } = await supabase.storage.from(BUCKET).remove(paths);
      if (error) {
        console.error("[hapus foto] storage remove", error);
        return false;
      }
      return true;
    },

    async markDeleted(ids) {
      const { data, error } = await supabase.rpc("mark_photos_deleted", { p_ids: ids });
      if (error) throw new Error(`Gagal menandai absen: ${error.message}`);
      return data;
    },

    async finishRun(runId, result) {
      const rows = [...result.companies].map(([companyId, t]) => ({
        run_id: runId,
        company_id: companyId,
        photos_deleted: t.photosDeleted,
        attendances_cleared: t.attendancesCleared,
        failed_count: t.failed,
      }));
      if (rows.length > 0) {
        const { error } = await supabase.from("photo_cleanup_run_companies").upsert(rows);
        if (error) console.error("[hapus foto] simpan ringkasan per usaha", error);
      }
      const { error } = await supabase
        .from("photo_cleanup_runs")
        .update({
          status: result.status,
          finished_at: new Date().toISOString(),
          photos_deleted: result.photosDeleted,
          attendances_cleared: result.attendancesCleared,
          companies_count: result.companies.size,
          failed_count: result.failed,
          error: result.error,
        })
        .eq("id", runId);
      if (error) console.error("[hapus foto] simpan ringkasan jalan", error);
    },
  };

  return runPhotoCleanup(deps);
}
