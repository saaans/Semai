import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export const metadata: Metadata = { title: "Masuk" };

export default function MasukPage() {
  return (
    <>
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl">Masuk ke Semai</h1>
        <p className="text-smoke">Untuk pemilik usaha. Form ini belum tersambung.</p>
      </div>
      <Card className="flex flex-col gap-4">
        <Button variant="secondary" arrow={false} fullWidth disabled>
          Masuk dengan Google
        </Button>
        <Input label="Email" type="email" autoComplete="email" disabled />
        <Input label="Password" type="password" autoComplete="current-password" disabled />
        <Button fullWidth disabled>
          Masuk
        </Button>
      </Card>
      <p className="text-sm text-smoke">
        Belum punya akun?{" "}
        <Link href="/daftar" className="font-medium text-ink underline underline-offset-4">
          Daftar gratis
        </Link>
      </p>
    </>
  );
}
