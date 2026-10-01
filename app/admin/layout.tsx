import type { Metadata } from "next";
import Link from "next/link";
import { LogoutButton } from "@/components/logout-button";
import { requirePlatformAdmin } from "@/lib/auth/session";
import { AdminNav } from "./_components/admin-nav";

export const metadata: Metadata = { title: { default: "Super admin", template: "%s · Admin Semai" } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Hanya tim Semai (profiles.is_platform_admin). Selain itu 404.
  await requirePlatformAdmin();
  return (
    <div className="mx-auto flex min-h-dvh max-w-6xl flex-col gap-6 px-4 py-5 sm:px-8 sm:py-6">
      <header className="flex flex-col gap-3 border-b border-stone pb-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center justify-between gap-4">
          <Link href="/admin" className="font-display text-2xl tracking-tight">
            semai <span className="text-sm text-smoke">admin</span>
          </Link>
          <div className="sm:hidden">
            <LogoutButton />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <AdminNav />
          <div className="hidden sm:block">
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="flex flex-1 flex-col gap-6">{children}</main>
    </div>
  );
}
