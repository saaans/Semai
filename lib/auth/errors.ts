import type { AuthError } from "@supabase/supabase-js";

/** Terjemahkan error Supabase Auth ke pesan yang jelas untuk owner. */
export function authErrorMessage(error: AuthError | null | undefined): string {
  switch (error?.code) {
    case "invalid_credentials":
      return "Email atau password salah. Cek lagi, atau pakai Lupa password.";
    case "email_not_confirmed":
      return "Email kamu belum diverifikasi. Buka tautan di email dari Semai, atau kirim ulang tautannya.";
    case "user_already_exists":
    case "email_exists":
      return "Email ini sudah terdaftar. Silakan masuk, atau pakai Lupa password.";
    case "weak_password":
      return "Password terlalu lemah. Pakai minimal 8 karakter, campur huruf dan angka.";
    case "same_password":
      return "Password baru sama dengan yang lama. Pakai password lain.";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return "Terlalu banyak percobaan. Tunggu beberapa menit, lalu coba lagi.";
    case "email_address_invalid":
      return "Alamat email ini tidak bisa dipakai. Pakai email lain yang aktif.";
    case "signup_disabled":
      return "Pendaftaran sedang ditutup sementara. Coba lagi nanti.";
    case "otp_expired":
      return "Tautan sudah kedaluwarsa atau sudah dipakai. Minta tautan baru.";
    case "session_not_found":
    case "refresh_token_not_found":
      return "Sesi kamu sudah habis. Silakan masuk lagi.";
    default:
      return "Ada kendala saat menghubungi server. Cek koneksi internet, lalu coba lagi.";
  }
}

/** Pesan untuk ?error= di halaman masuk (dari callback). */
export const callbackErrors: Record<string, string> = {
  tautan:
    "Tautan verifikasi tidak valid atau sudah kedaluwarsa. Coba masuk, atau minta tautan baru.",
  google: "Masuk dengan Google dibatalkan atau gagal. Coba lagi.",
  server: "Ada kendala di server saat menyiapkan akunmu. Coba masuk lagi beberapa saat lagi.",
};
