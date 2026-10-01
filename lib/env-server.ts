import "server-only";
import { z } from "zod";

const serverEnvSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, {
    error: "SUPABASE_SERVICE_ROLE_KEY belum diisi. Salin service_role key dari Supabase Dashboard ke .env.local.",
  }),
  EMPLOYEE_PIN_SECRET: z.string().min(32, {
    error: "EMPLOYEE_PIN_SECRET belum diisi atau kurang dari 32 karakter. Buat dengan: openssl rand -base64 48",
  }),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

/** Variabel rahasia khusus server. Jangan pernah dipakai di komponen client. */
export function getServerEnv(): ServerEnv {
  const parsed = serverEnvSchema.safeParse({
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    EMPLOYEE_PIN_SECRET: process.env.EMPLOYEE_PIN_SECRET,
  });
  if (!parsed.success) {
    const messages = parsed.error.issues.map((issue) => issue.message);
    throw new Error(`Konfigurasi server belum lengkap:\n- ${messages.join("\n- ")}`);
  }
  return parsed.data;
}
