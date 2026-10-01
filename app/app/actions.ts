"use server";

import { redirect, unstable_rethrow } from "next/navigation";
import { fieldErrors } from "@/lib/auth/schemas";
import { signInWithPin } from "@/lib/employees/login";
import {
  employeeEmail,
  hashInviteToken,
  isInviteTokenFormat,
  pinToPassword,
} from "@/lib/employees/pin";
import { masukKaryawanSchema, pinBaruSchema, pinLamaSchema } from "@/lib/employees/schemas";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type FormState = {
  errors?: Record<string, string>;
  message?: string;
  values?: Record<string, string>;
};

const INVALID_LINK =
  "Link aktivasi tidak berlaku lagi. Minta link baru ke pemilik usaha lewat WA.";
const SERVER_ERROR = "Ada kendala di server. Cek koneksi internet, lalu coba lagi.";

/**
 * Pesan error dengan kode singkat (langkah + kode Supabase) supaya penyebab
 * bisa dilaporkan dari layar HP tanpa membuka log. Tidak berisi data rahasia.
 */
function serverError(step: string, error?: unknown): FormState {
  console.error(`[aktivasi] ${step}`, error);
  const code =
    error && typeof error === "object" && "code" in error && typeof error.code === "string"
      ? `:${error.code}`
      : "";
  return { message: `${SERVER_ERROR} (kode: ${step}${code})` };
}

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

/** Masuk karyawan: nomor HP + PIN. */
async function masukKaryawanImpl(formData: FormData): Promise<FormState> {
  const values = { phone: text(formData, "phone") };
  const parsed = masukKaryawanSchema.safeParse({ ...values, pin: text(formData, "pin") });
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values };

  const result = await signInWithPin(parsed.data.phone, parsed.data.pin);
  if (!result.ok) return { message: result.message, values };

  // Akun benar, tapi harus aktif di minimal satu usaha.
  const supabase = await createClient();
  const { count } = await supabase
    .from("employees")
    .select("id", { count: "exact", head: true })
    .eq("status", "aktif");
  if (!count) {
    await supabase.auth.signOut();
    return {
      message: "Akunmu sedang nonaktif di semua usaha. Hubungi pemilik usaha kalau ini keliru.",
      values,
    };
  }

  redirect("/app");
}

/**
 * Aktivasi dari link undangan. Nomor yang belum punya akun (atau PIN-nya
 * direset) membuat PIN baru; nomor yang sudah aktif di usaha lain memakai
 * PIN yang sudah ada.
 */
async function aktivasiImpl(formData: FormData): Promise<FormState> {
  const token = text(formData, "token");
  if (!isInviteTokenFormat(token)) return { message: INVALID_LINK };
  const tokenHash = hashInviteToken(token);

  const admin = createAdminClient();
  const { data: employee, error: employeeError } = await admin
    .from("employees")
    .select("id, phone, full_name, status, invite_expires_at")
    .eq("invite_token_hash", tokenHash)
    .maybeSingle();
  if (employeeError) {
    return serverError("baca-karyawan", employeeError);
  }
  if (
    !employee ||
    employee.status === "nonaktif" ||
    !employee.invite_expires_at ||
    new Date(employee.invite_expires_at) <= new Date()
  ) {
    return { message: INVALID_LINK };
  }

  const { data: accounts, error: accountError } = await admin.rpc("employee_auth_account", {
    p_phone: employee.phone,
  });
  if (accountError) {
    return serverError("cek-akun", accountError);
  }
  const account = accounts[0];
  let userId: string;

  if (account && !account.pin_reset) {
    // Sudah punya akun di usaha lain: buktikan dengan PIN yang ada.
    const parsed = pinLamaSchema.safeParse({ pin: text(formData, "pin") });
    if (!parsed.success) return { errors: fieldErrors(parsed.error) };
    const result = await signInWithPin(employee.phone, parsed.data.pin);
    if (!result.ok) return { message: result.message };
    userId = account.user_id;
  } else {
    const parsed = pinBaruSchema.safeParse({
      pin: text(formData, "pin"),
      confirm: text(formData, "confirm"),
    });
    if (!parsed.success) return { errors: fieldErrors(parsed.error) };
    const password = pinToPassword(employee.phone, parsed.data.pin);

    if (account) {
      const { error } = await admin.auth.admin.updateUserById(account.user_id, {
        password,
        app_metadata: { pin_reset: false },
      });
      if (error) {
        return serverError("ganti-pin", error);
      }
      userId = account.user_id;
    } else {
      const { data, error } = await admin.auth.admin.createUser({
        email: employeeEmail(employee.phone),
        password,
        email_confirm: true,
        user_metadata: { full_name: employee.full_name, phone: employee.phone },
        app_metadata: { role: "employee" },
      });
      if (error || !data.user) {
        return serverError("buat-akun", error);
      }
      userId = data.user.id;
    }

    await admin.rpc("employee_login_succeeded", { p_phone: employee.phone });
    const supabase = await createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: employeeEmail(employee.phone),
      password,
    });
    if (signInError) {
      return serverError("masuk", signInError);
    }
  }

  // Sambungkan akun ke data karyawan. Syarat token yang sama mencegah link dipakai dua kali.
  const { data: linked, error: linkError } = await admin
    .from("employees")
    .update({
      user_id: userId,
      status: "aktif",
      ...(employee.status === "diundang" ? { activated_at: new Date().toISOString() } : {}),
      invite_token_hash: null,
      invite_expires_at: null,
    })
    .eq("id", employee.id)
    .eq("invite_token_hash", tokenHash)
    .select("id");
  if (linkError) {
    return serverError("sambung", linkError);
  }
  if (linked.length === 0) return { message: INVALID_LINK };

  redirect("/app");
}

/**
 * Jalankan aksi dan ubah error tak terduga (env belum diisi, Supabase menolak)
 * jadi pesan biasa, plus log di server supaya penyebabnya terlihat di Vercel Logs.
 */
async function guarded(name: string, run: () => Promise<FormState>): Promise<FormState> {
  try {
    return await run();
  } catch (error) {
    unstable_rethrow(error); // redirect() harus diteruskan
    console.error(`[${name}]`, error);
    const isConfig = error instanceof Error && error.message.startsWith("Konfigurasi server");
    return {
      message: isConfig
        ? `Server belum dikonfigurasi lengkap. Hubungi pemilik usaha. (kode: ${name}:env)`
        : `${SERVER_ERROR} (kode: ${name})`,
    };
  }
}

export async function masukKaryawan(_prev: FormState, formData: FormData): Promise<FormState> {
  return guarded("masuk-karyawan", () => masukKaryawanImpl(formData));
}

export async function aktivasi(_prev: FormState, formData: FormData): Promise<FormState> {
  return guarded("aktivasi", () => aktivasiImpl(formData));
}

export async function keluarKaryawan() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/app/masuk");
}
