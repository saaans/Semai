import type { Metadata } from "next";
import { Card } from "@/components/ui/card";
import { AturPasswordForm } from "./atur-password-form";

export const metadata: Metadata = { title: "Atur password baru" };

// Halaman ini wajib login (lewat tautan reset); dijaga di proxy.
export default function AturPasswordPage() {
  return (
    <>
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl">Buat password baru</h1>
        <p className="text-smoke">Setelah disimpan, kamu langsung masuk ke Semai.</p>
      </div>
      <Card>
        <AturPasswordForm />
      </Card>
    </>
  );
}
