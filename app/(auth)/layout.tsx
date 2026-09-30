import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col gap-10 px-5 py-6">
      <Link href="/" className="font-display text-2xl tracking-tight">
        semai
      </Link>
      <main className="flex flex-1 flex-col gap-6">{children}</main>
    </div>
  );
}
