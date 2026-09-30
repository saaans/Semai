import Link from "next/link";

export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-6xl flex-col gap-8 px-5 py-6 sm:px-8">
      <header className="flex items-center justify-between border-b border-stone pb-4">
        <Link href="/owner" className="font-display text-2xl tracking-tight">
          semai
        </Link>
        <span className="text-sm text-smoke">Owner</span>
      </header>
      <main className="flex flex-1 flex-col gap-6">{children}</main>
    </div>
  );
}
