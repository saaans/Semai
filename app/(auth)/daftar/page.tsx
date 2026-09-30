import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export const metadata: Metadata = { title: "Daftar" };

export default function DaftarPage() {
  return (
    <>
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl">Daftar gratis</h1>
        <p className="text-smoke">
          Mulai dengan paket Benih, tanpa kartu kredit. Form ini belum tersambung.
        </p>
      </div>
      <Card className="flex flex-col gap-4">
        <Button variant="secondary" arrow={false} fullWidth disabled>
          Daftar dengan Google
        </Button>
        <Input label="Nama" autoComplete="name" disabled />
        <Input label="Email" type="email" autoComplete="email" disabled />
        <Input label="Nomor WA" type="tel" inputMode="tel" autoComplete="tel" disabled />
        <Input
          label="Password"
          type="password"
          autoComplete="new-password"
          hint="Minimal 8 karakter."
          disabled
        />
        <Button fullWidth disabled>
          Buat akun
        </Button>
      </Card>
      <p className="text-sm text-smoke">
        Sudah punya akun?{" "}
        <Link href="/masuk" className="font-medium text-ink underline underline-offset-4">
          Masuk
        </Link>
      </p>
    </>
  );
}
