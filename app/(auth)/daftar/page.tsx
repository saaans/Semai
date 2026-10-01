import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { OrDivider } from "../_components/form-alert";
import { GoogleButton } from "../_components/google-button";
import { DaftarForm } from "./daftar-form";

export const metadata: Metadata = { title: "Daftar" };

export default function DaftarPage() {
  return (
    <>
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl">Daftar gratis</h1>
        <p className="text-smoke">Mulai dengan paket Benih, tanpa kartu kredit.</p>
      </div>
      <Card className="flex flex-col gap-4">
        <GoogleButton label="Daftar dengan Google" />
        <OrDivider />
        <DaftarForm />
        <p className="text-xs leading-relaxed text-smoke">
          Dengan mendaftar kamu setuju dengan{" "}
          <Link href="/syarat" className="text-ink underline underline-offset-4">
            Syarat &amp; Ketentuan
          </Link>{" "}
          dan{" "}
          <Link href="/privasi" className="text-ink underline underline-offset-4">
            Kebijakan Privasi
          </Link>{" "}
          Semai.
        </p>
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
