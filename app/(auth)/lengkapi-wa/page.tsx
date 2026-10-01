import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { getOwnerState, homePathFor } from "@/lib/auth/session";
import { LengkapiWaForm } from "./lengkapi-wa-form";

export const metadata: Metadata = { title: "Lengkapi nomor WA" };

export default async function LengkapiWaPage() {
  const state = await getOwnerState();
  // Hanya untuk owner yang belum punya nomor WA (biasanya daftar via Google).
  if (state.kind !== "member" || state.phone) redirect(homePathFor(state));

  return (
    <>
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl">Satu langkah lagi</h1>
        <p className="text-smoke">
          Isi nomor WA aktif supaya kami bisa menghubungimu soal akun dan tagihan.
        </p>
      </div>
      <Card>
        <LengkapiWaForm />
      </Card>
    </>
  );
}
