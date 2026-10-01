"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { FormAlert } from "@/app/(auth)/_components/form-alert";
import { SubmitButton } from "@/app/(auth)/_components/submit-button";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { tambahKaryawan, type KaryawanFormState } from "../actions";
import { InviteCard } from "./invite-card";
import { UpgradeCard } from "./upgrade-card";

type Props = { planName: string; limit: number | null };

function Form({ planName, limit, onAgain }: Props & { onAgain: () => void }) {
  const [state, action] = useActionState<KaryawanFormState, FormData>(tambahKaryawan, {});

  if (state.invite) {
    return (
      <div className="flex flex-col gap-3">
        <InviteCard invite={state.invite} />
        <Button variant="secondary" arrow={false} fullWidth onClick={onAgain}>
          Tambah karyawan lain
        </Button>
        <Link
          href="/owner/karyawan"
          className="flex min-h-11 items-center justify-center text-sm text-graphite underline underline-offset-4"
        >
          Lihat daftar karyawan
        </Link>
      </div>
    );
  }
  if (state.limitReached) return <UpgradeCard planName={planName} limit={limit} />;

  return (
    <Card>
      <form action={action} className="flex flex-col gap-4" noValidate>
        {state.message && <FormAlert tone="error">{state.message}</FormAlert>}
        <Input
          label="Nama lengkap"
          name="fullName"
          autoComplete="off"
          placeholder="Contoh: Siti Aminah"
          defaultValue={state.values?.fullName}
          error={state.errors?.fullName}
          required
        />
        <Input
          label="Nomor WA"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="off"
          placeholder="0812 3456 7890"
          hint="Dipakai karyawan untuk masuk, dan tujuan link undangan."
          defaultValue={state.values?.phone}
          error={state.errors?.phone}
          required
        />
        <Input
          label="Jabatan"
          name="position"
          placeholder="Contoh: Kasir"
          defaultValue={state.values?.position}
          error={state.errors?.position}
        />
        <Input
          label="Gaji pokok per bulan (Rp)"
          name="baseSalary"
          inputMode="numeric"
          placeholder="Contoh: 2500000"
          hint="Boleh dikosongkan dulu dan diisi nanti di menu gaji."
          defaultValue={state.values?.baseSalary}
          error={state.errors?.baseSalary}
        />
        <SubmitButton pendingText="Menyimpan…">Simpan dan buat link undangan</SubmitButton>
      </form>
    </Card>
  );
}

/** Form tambah karyawan. "Tambah karyawan lain" memasang ulang form supaya kosong. */
export function TambahForm(props: Props) {
  const [round, setRound] = useState(0);
  return <Form key={round} {...props} onAgain={() => setRound((r) => r + 1)} />;
}
