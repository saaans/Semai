import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LogoutButton } from "@/components/logout-button";
import { getOwnerState, homePathFor } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Akun ditangguhkan" };

export default async function DitangguhkanPage() {
  const state = await getOwnerState();
  if (state.kind !== "member" || !state.suspended) redirect(homePathFor(state));

  return (
    <>
      <div className="flex flex-col gap-3">
        <h1 className="text-3xl">Akun usahamu sedang ditangguhkan</h1>
        <p className="text-smoke">
          Tim Semai menangguhkan akun ini, jadi dashboard belum bisa dibuka. Karyawan tetap bisa absen seperti biasa
          dan semua data aman.
        </p>
        <p className="text-smoke">Hubungi tim Semai lewat WhatsApp untuk tahu alasannya dan mengaktifkannya lagi.</p>
      </div>
      <div>
        <LogoutButton />
      </div>
    </>
  );
}
