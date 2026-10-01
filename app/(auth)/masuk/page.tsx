import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { callbackErrors } from "@/lib/auth/errors";
import { safeNextPath } from "@/lib/auth/session";
import { FormAlert, OrDivider } from "../_components/form-alert";
import { GoogleButton } from "../_components/google-button";
import { MasukForm } from "./masuk-form";

export const metadata: Metadata = { title: "Masuk" };

export default async function MasukPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  const next = safeNextPath(params.next);
  const error = params.error ? callbackErrors[params.error] : undefined;

  return (
    <>
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl">Masuk ke Semai</h1>
        <p className="text-smoke">
          Untuk pemilik usaha. Karyawan masuk lewat aplikasi Semai dengan nomor HP dan PIN.
        </p>
      </div>
      {error && <FormAlert tone="error">{error}</FormAlert>}
      <Card className="flex flex-col gap-4">
        <GoogleButton label="Masuk dengan Google" next={next} />
        <OrDivider />
        <MasukForm next={next} />
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
