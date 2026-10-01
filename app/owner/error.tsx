"use client";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";

export default function OwnerError({ reset }: { error: Error; reset: () => void }) {
  return (
    <Card className="flex flex-col gap-4">
      <div>
        <CardTitle>Halaman gagal dimuat</CardTitle>
        <CardDescription>
          Ada kendala saat mengambil data usahamu. Cek koneksi internet, lalu coba lagi.
        </CardDescription>
      </div>
      <Button onClick={reset} className="self-start">
        Coba lagi
      </Button>
    </Card>
  );
}
