import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tag } from "@/components/ui/tag";

export const metadata: Metadata = { title: "Absen" };

export default function EmployeeAppPage() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 px-5 py-6">
      <header className="flex items-center justify-between">
        <span className="font-display text-2xl tracking-tight">semai</span>
        <Tag>Belum absen</Tag>
      </header>
      <main className="flex flex-1 flex-col gap-6">
        <div className="flex flex-col gap-1">
          <p className="text-sm text-smoke">Jadwal hari ini</p>
          <h1 className="text-3xl">Halo</h1>
        </div>
        <Card className="flex flex-col gap-4">
          <div>
            <p className="text-sm text-smoke">Jam kerja</p>
            <p className="mt-1 font-mono text-lg">08.00 – 17.00</p>
          </div>
          <Button fullWidth disabled>
            Absen masuk
          </Button>
          <p className="text-sm text-ash">Absen selfie + GPS dibuat di langkah berikutnya.</p>
        </Card>
      </main>
    </div>
  );
}
