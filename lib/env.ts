import { z } from "zod";

const supabaseEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url({
    error: "NEXT_PUBLIC_SUPABASE_URL belum diisi atau bukan URL. Salin dari Supabase Dashboard ke .env.local.",
  }),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, {
    error: "NEXT_PUBLIC_SUPABASE_ANON_KEY belum diisi. Salin dari Supabase Dashboard ke .env.local.",
  }),
});

export type SupabaseEnv = { url: string; anonKey: string };

// Variabel NEXT_PUBLIC_* harus dibaca satu per satu supaya di-inline oleh Next.js di browser.
function readRaw() {
  return {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };
}

/** True kalau variabel Supabase sudah diisi. */
export function hasSupabaseEnv(): boolean {
  return supabaseEnvSchema.safeParse(readRaw()).success;
}

/** Ambil konfigurasi Supabase, lempar error yang jelas kalau belum diisi. */
export function getSupabaseEnv(): SupabaseEnv {
  const parsed = supabaseEnvSchema.safeParse(readRaw());
  if (!parsed.success) {
    const messages = parsed.error.issues.map((issue) => issue.message);
    throw new Error(`Konfigurasi Supabase belum lengkap:\n- ${messages.join("\n- ")}`);
  }
  return {
    url: parsed.data.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: parsed.data.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };
}
