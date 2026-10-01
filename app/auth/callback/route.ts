import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { safeNextPath } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

const OTP_TYPES: EmailOtpType[] = ["signup", "email", "recovery", "invite", "magiclink", "email_change"];

/**
 * Tujuan tautan dari Google OAuth, verifikasi email, dan reset password.
 * - ?code=...                → OAuth / tautan email (PKCE, satu perangkat)
 * - ?token_hash=...&type=... → tautan email (bisa dibuka di perangkat lain)
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = safeNextPath(searchParams.get("next"));

  const fail = (reason: "tautan" | "google") =>
    NextResponse.redirect(new URL(`/masuk?error=${reason}`, origin));

  // ?error=access_denied kalau owner membatalkan Google, atau error_code=otp_expired
  // kalau tautan email sudah kedaluwarsa.
  if (searchParams.get("error")) {
    return fail(searchParams.get("error_code") === "otp_expired" ? "tautan" : "google");
  }

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return fail("tautan");
  } else if (tokenHash && type && OTP_TYPES.includes(type)) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (error) return fail("tautan");
  } else {
    return fail("tautan");
  }

  if (type === "recovery" || next === "/atur-password") {
    return NextResponse.redirect(new URL("/atur-password", origin));
  }

  // Sesi sudah tersimpan di cookie. /auth/lanjut membaca sesi itu di request
  // baru, menyiapkan usaha untuk owner baru, lalu mengarahkan ke halaman yang tepat.
  const target = new URL("/auth/lanjut", origin);
  if (next) target.searchParams.set("next", next);
  return NextResponse.redirect(target);
}
