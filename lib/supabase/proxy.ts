import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseEnv, hasSupabaseEnv } from "@/lib/env";
import type { Database } from "./types";

let warned = false;

/**
 * Refresh session Supabase di setiap request dan teruskan cookie baru
 * ke browser. Dipanggil dari proxy.ts di root.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  if (!hasSupabaseEnv()) {
    if (!warned && process.env.NODE_ENV !== "production") {
      console.warn(
        "[semai] Variabel Supabase belum diisi di .env.local, refresh session dilewati.",
      );
      warned = true;
    }
    return response;
  }

  const { url, anonKey } = getSupabaseEnv();

  const supabase = createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
        Object.entries(headers).forEach(([key, value]) =>
          response.headers.set(key, value),
        );
      },
    },
  });

  // Jangan taruh kode apa pun di antara createServerClient dan getClaims():
  // panggilan ini yang memvalidasi token dan me-refresh session.
  await supabase.auth.getClaims();

  // Proteksi route (/owner, /app, /admin) ditambahkan di langkah registrasi.
  return response;
}
