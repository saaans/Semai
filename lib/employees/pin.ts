import "server-only";
import { createHash, createHmac, randomBytes } from "node:crypto";
import { getServerEnv } from "@/lib/env-server";

const EMPLOYEE_EMAIL_DOMAIN = "karyawan.semai.internal";

/** Email sintetis akun Auth karyawan: {62xxxxxxxxxx}@karyawan.semai.internal. */
export function employeeEmail(phone: string): string {
  return `${phone}@${EMPLOYEE_EMAIL_DOMAIN}`;
}

/**
 * Password Supabase dari PIN. PIN 6 digit terlalu mudah ditebak kalau dipakai
 * langsung (API Supabase bisa dipanggil tanpa lewat app). Dengan HMAC + secret
 * server, tebakan hanya bisa lewat app yang membatasi 5 percobaan.
 */
export function pinToPassword(phone: string, pin: string): string {
  const { EMPLOYEE_PIN_SECRET } = getServerEnv();
  const digest = createHmac("sha256", EMPLOYEE_PIN_SECRET).update(`${phone}:${pin}`).digest("base64url");
  // Awalan menjamin huruf besar, kecil, angka, dan simbol (aturan password Supabase).
  return `Sm1!${digest}`;
}

/** Password acak untuk mematikan PIN lama saat reset. */
export function randomPassword(): string {
  return `Rs1!${randomBytes(32).toString("base64url")}`;
}

/** Sama dengan public.hash_invite_token() di database. */
export function hashInviteToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** Token undangan: 64 karakter heksadesimal. */
export function isInviteTokenFormat(token: string): boolean {
  return /^[0-9a-f]{64}$/.test(token);
}
