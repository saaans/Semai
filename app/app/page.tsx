import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Tag } from "@/components/ui/tag";
import { requireEmployee } from "@/lib/auth/session";
import { keluarKaryawan } from "./actions";
import { EmployeeShell } from "./_components/employee-shell";

export const metadata: Metadata = { title: "Absen" };

function LogoutKaryawan() {
  return (
    <form action={keluarKaryawan}>
      <button
        type="submit"
        className="min-h-11 rounded-button px-2 text-sm text-graphite underline-offset-4 hover:text-ink hover:underline"
      >
        Keluar
      </button>
    </form>
  );
}

export default async function EmployeeAppPage() {
  const { memberships } = await requireEmployee();
  const current = memberships[0];

  if (!current) {
    return (
      <EmployeeShell header={<LogoutKaryawan />}>
        <Card>
          <CardTitle>Akunmu sedang nonaktif</CardTitle>
          <CardDescription>
            Kamu belum terdaftar aktif di usaha mana pun. Hubungi pemilik usaha kalau ini keliru.
          </CardDescription>
        </Card>
      </EmployeeShell>
    );
  }

  return (
    <EmployeeShell header={<LogoutKaryawan />}>
      <div className="flex flex-col gap-1">
        <p className="text-sm text-smoke">{current.companyName}</p>
        <h1 className="text-3xl">Halo, {current.fullName.split(/\s+/)[0]}</h1>
      </div>
      <Card className="flex flex-col gap-4">
        <Tag className="self-start">Belum absen</Tag>
        <Button fullWidth disabled>
          Absen masuk
        </Button>
        <p className="text-sm text-ash">Absen selfie + GPS dibuat di langkah berikutnya.</p>
      </Card>
      {memberships.length > 1 && (
        <p className="text-sm text-smoke">
          Kamu juga terdaftar di{" "}
          {memberships
            .slice(1)
            .map((m) => m.companyName)
            .join(", ")}
          .
        </p>
      )}
    </EmployeeShell>
  );
}
