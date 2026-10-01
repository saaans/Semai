"use client";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";

export default function EmployeeError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 px-5 py-6">
      <span className="font-display text-2xl tracking-tight">semai</span>
      <Card className="flex flex-col gap-4">
        <div>
          <CardTitle>Halaman gagal dimuat</CardTitle>
          <CardDescription>
            Ada kendala di server. Cek koneksi internet, lalu coba lagi. Kalau masih gagal, masuk
            ulang lewat halaman masuk.
          </CardDescription>
        </div>
        <Button onClick={reset} className="self-start">
          Coba lagi
        </Button>
        <a href="/app/masuk" className="text-sm text-graphite underline underline-offset-4">
          Ke halaman masuk
        </a>
      </Card>
    </div>
  );
}
