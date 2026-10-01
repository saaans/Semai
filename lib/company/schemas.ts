import { z } from "zod";
import { normalizePhone } from "@/lib/auth/schemas";
import { profilUsahaSchema } from "@/lib/onboarding/schemas";

/** Form profil usaha di pengaturan. Aturan resmi tetap di RPC update_company_profile. */
export const profilSchema = profilUsahaSchema.omit({ phone: true }).extend({
  address: z
    .string()
    .trim()
    .max(200, { error: "Alamat terlalu panjang, maksimal 200 karakter." }),
  businessPhone: z
    .string()
    .trim()
    .transform((value, ctx) => {
      if (value === "") return null;
      const normalized = normalizePhone(value);
      if (!normalized) {
        ctx.issues.push({
          code: "custom",
          input: value,
          message: "Nomor WA usaha belum benar. Contoh: 0812 3456 7890, atau kosongkan.",
        });
        return z.NEVER;
      }
      return normalized;
    }),
});

export type ProfilInput = z.infer<typeof profilSchema>;
