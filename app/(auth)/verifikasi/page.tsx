import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { emailSchema } from "@/lib/auth/schemas";
import { ResendVerification } from "../_components/resend-verification";

export const metadata: Metadata = { title: "Verifikasi email" };

export default async function VerifikasiPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const parsed = emailSchema.safeParse({ email: (await searchParams).email ?? "" });
  const email = parsed.success ? parsed.data.email : null;

  return (
    <>
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl">Cek email kamu</h1>
        <p className="text-smoke">
          {email ? (
            <>
              Kami sudah kirim tautan verifikasi ke{" "}
              <span className="font-medium text-ink">{email}</span>.
            </>
          ) : (
            "Kami sudah kirim tautan verifikasi ke email yang kamu daftarkan."
          )}{" "}
          Buka tautan itu untuk mengaktifkan akun, lalu kamu langsung masuk ke pengaturan usaha.
        </p>
      </div>
      <Card className="flex flex-col gap-4">
        <div>
          <CardTitle>Belum masuk emailnya?</CardTitle>
          <CardDescription>
            Tunggu 1–2 menit dan cek folder spam atau promosi. Kalau tetap tidak ada, kirim
            ulang tautannya.
          </CardDescription>
        </div>
        {email && <ResendVerification email={email} />}
      </Card>
      <p className="text-sm text-smoke">
        Salah ketik email?{" "}
        <Link href="/daftar" className="font-medium text-ink underline underline-offset-4">
          Daftar ulang
        </Link>
        {" · "}
        <Link href="/masuk" className="font-medium text-ink underline underline-offset-4">
          Masuk
        </Link>
      </p>
    </>
  );
}
