import { requirePlatformAdmin } from "@/lib/auth/session";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Hanya tim Semai (profiles.is_platform_admin). Selain itu 404.
  await requirePlatformAdmin();
  return children;
}
