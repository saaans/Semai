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
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;

  // Cek cepat berbasis sesi. Cek keanggotaan usaha dan is_platform_admin
  // yang sebenarnya ada di layout /owner dan /admin (lib/auth/session.ts).
  const { pathname, search } = request.nextUrl;

  if (!claims && PROTECTED_PREFIXES.some((prefix) => matches(pathname, prefix))) {
    const url = request.nextUrl.clone();
    url.pathname = "/masuk";
    url.search = "";
    url.searchParams.set("next", `${pathname}${search}`);
    return redirectWithCookies(url, response);
  }

  // Owner yang sudah login tidak perlu melihat form masuk/daftar lagi.
  // Kecuali ada ?error=, supaya pesan dari callback tetap tampil.
  const isEmployee =
    typeof claims?.email === "string" && claims.email.endsWith("@karyawan.semai.internal");
  if (
    claims &&
    !isEmployee &&
    GUEST_ONLY.some((prefix) => matches(pathname, prefix)) &&
    !request.nextUrl.searchParams.has("error")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/lanjut";
    url.search = "";
    return redirectWithCookies(url, response);
  }

  return response;
}

/** Wajib login. /app (karyawan) diatur di langkah login karyawan. */
const PROTECTED_PREFIXES = ["/owner", "/admin", "/lengkapi-wa", "/atur-password"];

/** Hanya untuk tamu. */
const GUEST_ONLY = ["/masuk", "/daftar"];

function matches(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/** Redirect sambil membawa cookie sesi yang baru di-refresh. */
function redirectWithCookies(url: URL, from: NextResponse) {
  const redirect = NextResponse.redirect(url);
  from.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  return redirect;
}
