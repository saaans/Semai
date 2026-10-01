import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { LupaPasswordForm } from "./lupa-password-form";

export const metadata: Metadata = { title: "Lupa password" };

export default function LupaPasswordPage() {
  return (
    <>
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl">Lupa password</h1>
        <p className="text-smoke">
          Masukkan email akunmu. Kami kirim tautan untuk membuat password baru.
        </p>
      </div>
      <Card>
        <LupaPasswordForm />
      </Card>
      <p className="text-sm text-smoke">
        Daftar pakai Google? Langsung{" "}
        <Link href="/masuk" className="font-medium text-ink underline underline-offset-4">
          masuk dengan Google
        </Link>{" "}
        tanpa password.
      </p>
    </>
  );
}
