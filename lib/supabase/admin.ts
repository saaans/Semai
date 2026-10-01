import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "@/lib/env";
import { getServerEnv } from "@/lib/env-server";
import type { Database } from "./types";

/**
 * Client service role: melewati RLS. Hanya untuk aksi server yang sudah
 * mengecek hak akses sendiri (aktivasi karyawan, login PIN, reset PIN).
 */
export function createAdminClient() {
  const { url } = getSupabaseEnv();
  const { SUPABASE_SERVICE_ROLE_KEY } = getServerEnv();
  return createClient<Database>(url, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
