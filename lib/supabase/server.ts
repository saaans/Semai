import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseEnv } from "@/lib/env";
import type { Database } from "./types";

/**
 * Supabase client untuk Server Component, Server Action, dan Route Handler.
 * Buat baru di setiap request, jangan disimpan di variabel global.
 */
export async function createClient() {
  // cookies() dulu supaya halaman yang memakai client ini selalu dinamis.
  const cookieStore = await cookies();
  const { url, anonKey } = getSupabaseEnv();

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Dipanggil dari Server Component yang tidak boleh menulis cookie.
          // Aman diabaikan karena proxy.ts sudah me-refresh session.
        }
      },
    },
  });
}
