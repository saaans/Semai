import "server-only";
import { createClient } from "@/lib/supabase/server";

export type RemoteStatus = {
  /** Absen remote berlaku sekarang (paket berbayar, atau masih masa tenggang). */
  allowed: boolean;
  /** Terisi selama masa tenggang setelah turun ke Benih. */
  graceUntil: string | null;
};

/** Status absen remote usaha. Aturan resmi di RPC remote_attendance_status. */
export async function getRemoteStatus(companyId: string): Promise<RemoteStatus> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("remote_attendance_status", { p_company_id: companyId });
  if (error) {
    console.error("[getRemoteStatus]", error);
    return { allowed: false, graceUntil: null };
  }
  const row = data[0];
  return { allowed: Boolean(row?.allowed), graceUntil: row?.grace_until ?? null };
}
