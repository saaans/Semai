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

  // Login menuju /admin: tampilan khusus tim Semai supaya tidak tertukar dengan login owner.
  if (next?.startsWith("/admin")) {
    return (
      <div className="zona-gelap -mx-1 flex flex-col gap-6 rounded-card border border-gold/40 p-5 sm:p-6">
        <div className="flex flex-col gap-3">
          <span className="inline-flex items-center gap-2 self-start rounded-full border border-gold/60 px-3 py-1 text-xs font-medium text-gold">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M12 3 4.5 6v5.5c0 4.6 3.2 8.2 7.5 9.5 4.3-1.3 7.5-4.9 7.5-9.5V6L12 3Z" />
            </svg>
            Tim Semai
          </span>
          <h1 className="text-3xl">Masuk panel admin</h1>
          <p className="text-smoke">Khusus tim Semai. Setiap akses ke data usaha tercatat.</p>
        </div>
        {error && <FormAlert tone="error">{error}</FormAlert>}
        <Card className="flex flex-col gap-4">
          <GoogleButton label="Masuk dengan Google" next={next} />
          <OrDivider />
          <MasukForm next={next} />
        </Card>
        <p className="text-sm text-smoke">
          Pemilik usaha?{" "}
          <Link href="/masuk" className="font-medium text-ink underline underline-offset-4">
            Masuk di sini
          </Link>
        </p>
      </div>
    );
  }

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
