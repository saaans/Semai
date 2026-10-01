import "server-only";
import { headers } from "next/headers";

/**
 * URL dasar aplikasi untuk tautan email dan redirect OAuth.
 * Pakai NEXT_PUBLIC_SITE_URL kalau diisi, selain itu host dari request.
 */
export async function getSiteUrl(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto =
    h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
