import type { Metadata } from "next";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { isInviteTokenFormat } from "@/lib/employees/pin";
import { createClient } from "@/lib/supabase/server";
import { EmployeeShell } from "../../_components/employee-shell";
import { AktivasiForm } from "./aktivasi-form";

export const metadata: Metadata = { title: "Aktivasi akun", robots: { index: false } };

export default async function AktivasiPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  let invitation = null;
  if (isInviteTokenFormat(token)) {
    const supabase = await createClient();
    const { data } = await supabase.rpc("get_invitation", { p_token: token });
    invitation = data?.[0] ?? null;
  }

  if (!invitation) {
    return (
      <EmployeeShell>
        <Card>
          <CardTitle>Link tidak berlaku</CardTitle>
          <CardDescription>
            Link ini sudah dipakai, sudah lewat 7 hari, atau diganti link baru. Minta link baru ke
            pemilik usaha lewat WA.
          </CardDescription>
        </Card>
      </EmployeeShell>
    );
  }

  return (
    <EmployeeShell>
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl">Halo, {invitation.employee_name}</h1>
        <p className="text-smoke">
          Kamu diundang absen di <span className="text-ink">{invitation.company_name}</span>.
        </p>
      </div>
      <Card className="flex flex-col gap-5">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="text-smoke">Nama</dt>
          <dd className="text-ink">{invitation.employee_name}</dd>
          <dt className="text-smoke">Nomor HP</dt>
          <dd className="font-mono text-ink">{invitation.phone_masked}</dd>
        </dl>
        <p className="text-sm text-ash">
          Data salah? Jangan lanjutkan, hubungi pemilik usaha untuk memperbaikinya.
        </p>
        <AktivasiForm token={token} needsExistingPin={invitation.needs_existing_pin} />
      </Card>
    </EmployeeShell>
  );
}
