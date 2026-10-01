import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { employeeEmail, pinToPassword } from "./pin";

export type PinLoginResult = { ok: true } | { ok: false; message: string };

function minutesUntil(iso: string): number {
  return Math.max(1, Math.ceil((new Date(iso).getTime() - Date.now()) / 60000));
}

export function lockedMessage(lockedUntil: string): string {
  return `PIN salah 5 kali. Demi keamanan, coba lagi dalam ${minutesUntil(lockedUntil)} menit, atau minta pemilik usaha reset PIN.`;
}

/**
 * Masuk dengan nomor HP + PIN, dengan batas 5 percobaan salah lalu kunci
 * 15 menit per nomor. Sesi disimpan di cookie lewat client server biasa.
 */
export async function signInWithPin(phone: string, pin: string): Promise<PinLoginResult> {
  const admin = createAdminClient();

  const { data: lockedUntil, error: lockError } = await admin.rpc("employee_login_locked_until", {
    p_phone: phone,
  });
  if (lockError) {
    console.error("[login-pin] cek kunci", lockError);
    return { ok: false, message: "Ada kendala di server. Coba lagi sebentar lagi." };
  }
  if (lockedUntil) return { ok: false, message: lockedMessage(lockedUntil) };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: employeeEmail(phone),
    password: pinToPassword(phone, pin),
  });

  if (error) {
    if (error.code !== "invalid_credentials") {
      console.error("[login-pin] masuk", error);
      return {
        ok: false,
        message: "Ada kendala saat menghubungi server. Cek koneksi internet, lalu coba lagi.",
      };
    }
    const { data: remaining } = await admin.rpc("employee_login_failed", { p_phone: phone });
    if (remaining === 0) {
      return {
        ok: false,
        message: "PIN salah 5 kali. Demi keamanan, coba lagi dalam 15 menit, atau minta pemilik usaha reset PIN.",
      };
    }
    return {
      ok: false,
      message: `Nomor HP atau PIN salah. Sisa ${remaining ?? 4} percobaan sebelum dikunci 15 menit.`,
    };
  }

  await admin.rpc("employee_login_succeeded", { p_phone: phone });
  return { ok: true };
}
