"use server";

import { redirect } from "next/navigation";
import { authErrorMessage } from "@/lib/auth/errors";
import {
  daftarSchema,
  emailSchema,
  fieldErrors,
  masukSchema,
  passwordBaruSchema,
  phoneSchema,
} from "@/lib/auth/schemas";
import { getSessionUser, safeNextPath } from "@/lib/auth/session";
import { getSiteUrl } from "@/lib/auth/site-url";
import { createClient } from "@/lib/supabase/server";

export type FormState = {
  /** Error per field, kunci = nama input. */
  errors?: Record<string, string>;
  /** Error umum di atas form. */
  message?: string;
  /** Pesan berhasil (misalnya tautan sudah dikirim). */
  success?: string;
  /** Isian sebelumnya supaya form tidak kosong lagi saat error. Tanpa password. */
  values?: Record<string, string>;
  /** Email yang belum diverifikasi, untuk tombol kirim ulang. */
  unverifiedEmail?: string;
};

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

/** Tujuan setelah sesi terbentuk; /auth/lanjut yang memutuskan halaman akhirnya. */
function continuePath(next: string | null) {
  return next ? `/auth/lanjut?next=${encodeURIComponent(next)}` : "/auth/lanjut";
}

export async function daftar(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = {
    fullName: text(formData, "fullName"),
    email: text(formData, "email"),
    phone: text(formData, "phone"),
  };
  const parsed = daftarSchema.safeParse({ ...values, password: text(formData, "password") });
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values };

  const { fullName, email, phone, password } = parsed.data;
  const supabase = await createClient();
  const siteUrl = await getSiteUrl();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${siteUrl}/auth/callback`,
      // Disalin ke tabel profiles oleh trigger handle_new_user.
      data: { full_name: fullName, phone },
    },
  });

  if (error) {
    if (error.code === "user_already_exists" || error.code === "email_exists") {
      return { errors: { email: authErrorMessage(error) }, values };
    }
    return { message: authErrorMessage(error), values };
  }

  // Supabase tidak mengembalikan error untuk email yang sudah terdaftar
  // (identities kosong), supaya kita tetap bisa memberi tahu owner.
  if (data.user && data.user.identities?.length === 0) {
    return {
      errors: { email: "Email ini sudah terdaftar. Silakan masuk, atau pakai Lupa password." },
      values,
    };
  }

  // Verifikasi email dimatikan di Supabase: sesi langsung aktif.
  if (data.session) redirect(continuePath(null));

  redirect(`/verifikasi?email=${encodeURIComponent(email)}`);
}

export async function masuk(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = { email: text(formData, "email") };
  const next = safeNextPath(text(formData, "next"));
  const parsed = masukSchema.safeParse({ ...values, password: text(formData, "password") });
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    if (error.code === "email_not_confirmed") {
      return {
        message: authErrorMessage(error),
        unverifiedEmail: parsed.data.email,
        values,
      };
    }
    return { message: authErrorMessage(error), values };
  }

  redirect(continuePath(next));
}

export async function masukGoogle(formData: FormData) {
  const next = safeNextPath(text(formData, "next"));
  const supabase = await createClient();
  const siteUrl = await getSiteUrl();
  const callback = new URL("/auth/callback", siteUrl);
  if (next) callback.searchParams.set("next", next);

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: callback.toString(),
      queryParams: { prompt: "select_account" },
    },
  });

  if (error || !data.url) redirect("/masuk?error=google");
  redirect(data.url);
}

export async function kirimUlangVerifikasi(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = emailSchema.safeParse({ email: text(formData, "email") });
  if (!parsed.success) return { message: fieldErrors(parsed.error).email };

  const supabase = await createClient();
  const siteUrl = await getSiteUrl();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: parsed.data.email,
    options: { emailRedirectTo: `${siteUrl}/auth/callback` },
  });
  if (error) return { message: authErrorMessage(error) };

  return {
    success: `Tautan verifikasi baru sudah dikirim ke ${parsed.data.email}. Cek juga folder spam.`,
  };
}

export async function lupaPassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = { email: text(formData, "email") };
  const parsed = emailSchema.safeParse(values);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values };

  const supabase = await createClient();
  const siteUrl = await getSiteUrl();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${siteUrl}/auth/callback?next=/atur-password`,
  });
  if (error) return { message: authErrorMessage(error), values };

  return {
    success: `Kalau ${parsed.data.email} terdaftar di Semai, tautan untuk atur ulang password sudah dikirim. Cek juga folder spam.`,
    values,
  };
}

export async function aturPasswordBaru(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = passwordBaruSchema.safeParse({
    password: text(formData, "password"),
    confirm: text(formData, "confirm"),
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const user = await getSessionUser();
  if (!user) {
    return {
      message: "Sesi atur ulang password sudah habis. Minta tautan baru lewat Lupa password.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { message: authErrorMessage(error) };

  redirect(continuePath(null));
}

export async function simpanNomorWa(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = { phone: text(formData, "phone") };
  const parsed = phoneSchema.safeParse(values);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values };

  const user = await getSessionUser();
  if (!user) redirect("/masuk");

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ phone: parsed.data.phone })
    .eq("id", user.id);
  if (error) {
    return { message: "Nomor WA gagal disimpan. Cek koneksi internet, lalu coba lagi.", values };
  }

  redirect(continuePath(null));
}

export async function keluar() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/masuk");
}
