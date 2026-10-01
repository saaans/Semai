import { getSupabaseEnv } from "@/lib/env";

export const LOGO_BUCKET = "logo-usaha";
/** Sama dengan file_size_limit bucket logo-usaha. */
export const MAX_LOGO_BYTES = 200 * 1024;
export const LOGO_TYPES = ["image/webp", "image/jpeg", "image/png"] as const;

/** URL publik logo usaha (bucket publik, bukan data pribadi). */
export function companyLogoUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  const { url } = getSupabaseEnv();
  return `${url}/storage/v1/object/public/${LOGO_BUCKET}/${path.split("/").map(encodeURIComponent).join("/")}`;
}
