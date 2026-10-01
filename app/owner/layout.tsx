import Link from "next/link";
import { LogoutButton } from "@/components/logout-button";
import { requireOwner } from "@/lib/auth/session";

export default async function OwnerLayout({ children }: { children: React.ReactNode }) {
  // Wajib login + anggota usaha + nomor WA. Owner baru dibuatkan usaha kosong.
  const owner = await requireOwner();

  return (
    <div className="mx-auto flex min-h-dvh max-w-6xl flex-col gap-8 px-5 py-6 sm:px-8">
      <header className="flex items-center justify-between gap-4 border-b border-stone pb-4">
        <Link href="/owner" className="font-display text-2xl tracking-tight">
          semai
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          <Link href="/owner" className="min-h-11 content-center rounded-button px-2.5 text-graphite hover:bg-taupe hover:text-ink">
            Hari ini
          </Link>
          <Link href="/owner/karyawan" className="min-h-11 content-center rounded-button px-2.5 text-graphite hover:bg-taupe hover:text-ink">
            Karyawan
          </Link>
        </nav>
        <div className="flex min-w-0 items-center gap-3">
          <span className="hidden truncate text-sm text-smoke sm:inline">{owner.email ?? "Owner"}</span>
          <LogoutButton />
        </div>
      </header>
      <main className="flex flex-1 flex-col gap-6">{children}</main>
    </div>
  );
}
