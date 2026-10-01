import { NextResponse, type NextRequest } from "next/server";
import { getOwnerState, homePathFor, safeNextPath } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

/**
 * Titik masuk setelah login/daftar/verifikasi. Untuk owner yang baru
 * pertama kali masuk, getOwnerState() membuat usaha kosong + keanggotaan owner.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next = safeNextPath(searchParams.get("next"));
  const state = await getOwnerState();

  if (state.kind === "error") {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }

  let path = homePathFor(state);
  // ?next= hanya dipakai kalau akun sudah siap (nomor WA dan onboarding beres).
  if (state.kind === "member" && path === "/owner" && next) path = next;
  if (state.kind === "platform_admin" && next?.startsWith("/admin")) path = next;

  return NextResponse.redirect(new URL(path, origin));
}
