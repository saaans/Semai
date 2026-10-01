import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { getSessionUser, isEmployeeEmail } from "@/lib/auth/session";
import { EmployeeShell } from "../_components/employee-shell";
import { MasukKaryawanForm } from "./masuk-form";

export const metadata: Metadata = { title: "Masuk karyawan" };

export default async function MasukKaryawanPage() {
  const user = await getSessionUser();
  if (user && isEmployeeEmail(user.email)) redirect("/app");

  return (
    <EmployeeShell>
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl">Masuk untuk absen</h1>
        <p className="text-smoke">Pakai nomor HP yang didaftarkan pemilik usaha dan PIN kamu.</p>
      </div>
      <Card>
        <MasukKaryawanForm />
      </Card>
    </EmployeeShell>
  );
}
