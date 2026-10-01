import type { Metadata } from "next";
import { LogoutButton } from "@/components/logout-button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Super admin" };

const metrics = ["Usaha terdaftar", "Usaha aktif", "MRR", "Churn"];

export default function AdminPage() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-6xl flex-col gap-8 px-5 py-6 sm:px-8">
      <header className="flex items-center justify-between border-b border-stone pb-4">
        <span className="font-display text-2xl tracking-tight">semai</span>
        <div className="flex items-center gap-3">
          <span className="text-sm text-smoke">Super admin</span>
          <LogoutButton />
        </div>
      </header>
      <main className="flex flex-col gap-6">
        <h1 className="text-3xl sm:text-4xl">Ringkasan bisnis</h1>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {metrics.map((label) => (
            <Card key={label}>
              <p className="text-sm text-smoke">{label}</p>
              <p className="mt-2 font-display text-4xl">–</p>
            </Card>
          ))}
        </div>
        <Card>
          <CardTitle>Khusus tim Semai</CardTitle>
          <CardDescription>
            Halaman ini hanya bisa dibuka akun dengan flag is_platform_admin.
          </CardDescription>
        </Card>
      </main>
    </div>
  );
}
