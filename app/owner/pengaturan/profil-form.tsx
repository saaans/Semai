"use client";

import { useActionState } from "react";
import { FormAlert } from "@/app/(auth)/_components/form-alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatPhone } from "@/lib/auth/schemas";
import { BUSINESS_TYPES, TIMEZONES } from "@/lib/onboarding/defaults";
import { ChoiceGroup } from "../onboarding/_components/choice-group";
import { simpanProfil, type ProfilState } from "./actions";

export type ProfilInitial = {
  name: string;
  businessType: string | null;
  city: string;
  timezone: string;
  address: string;
  phone: string | null;
};

export function ProfilForm({ initial }: { initial: ProfilInitial }) {
  const [state, action, pending] = useActionState<ProfilState, FormData>(simpanProfil, {});
  const errors = state.errors ?? {};

  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      {state.message && <FormAlert tone="error">{state.message}</FormAlert>}
      {state.saved && <FormAlert tone="success">Profil usaha disimpan.</FormAlert>}
      <Input
        label="Nama usaha"
        name="name"
        autoComplete="organization"
        defaultValue={initial.name}
        error={errors.name}
        required
      />
      <ChoiceGroup
        label="Bidang usaha"
        name="businessType"
        options={BUSINESS_TYPES}
        defaultValue={initial.businessType}
        error={errors.businessType}
      />
      <Input
        label="Kota"
        name="city"
        autoComplete="address-level2"
        defaultValue={initial.city}
        error={errors.city}
        required
      />
      <Input
        label="Alamat"
        name="address"
        autoComplete="street-address"
        placeholder="Contoh: Jl. Merdeka No. 12, Sumur Bandung"
        hint="Opsional. Tampil di slip gaji."
        defaultValue={initial.address}
        error={errors.address}
      />
      <Input
        label="Nomor WA usaha"
        name="businessPhone"
        type="tel"
        inputMode="tel"
        placeholder="0812 3456 7890"
        hint="Opsional. Nomor yang bisa dihubungi karyawan."
        defaultValue={initial.phone ? formatPhone(initial.phone) : ""}
        error={errors.businessPhone}
      />
      <ChoiceGroup
        label="Zona waktu"
        name="timezone"
        columns={3}
        options={TIMEZONES}
        defaultValue={initial.timezone}
        error={errors.timezone}
      />
      <p className="-mt-3 text-sm text-ash">
        Mengganti zona waktu tidak mengubah jam absen yang sudah tercatat, hanya cara jamnya
        ditampilkan. Jadwal kerja berikutnya mengikuti zona baru.
      </p>
      <Button type="submit" className="self-start" disabled={pending} aria-busy={pending}>
        {pending ? "Menyimpan…" : "Simpan profil"}
      </Button>
    </form>
  );
}
