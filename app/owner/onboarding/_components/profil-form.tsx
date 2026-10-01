"use client";

import { FormAlert } from "@/app/(auth)/_components/form-alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BUSINESS_TYPES, TIMEZONES } from "@/lib/onboarding/defaults";
import { simpanProfilUsaha } from "../actions";
import { ChoiceGroup } from "./choice-group";
import { useStepForm } from "./use-step-form";

export function ProfilForm({
  initial,
}: {
  initial: {
    name: string | null;
    businessType: string | null;
    city: string | null;
    timezone: string;
    phone: string;
  };
}) {
  const { state, pending, onSubmit } = useStepForm(simpanProfilUsaha);
  const errors = state.errors ?? {};

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
      {state.message && <FormAlert tone="error">{state.message}</FormAlert>}
      <Input
        label="Nama usaha"
        name="name"
        placeholder="Contoh: Warung Bu Sri"
        autoComplete="organization"
        defaultValue={initial.name ?? ""}
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
        placeholder="Contoh: Bandung"
        autoComplete="address-level2"
        defaultValue={initial.city ?? ""}
        error={errors.city}
        required
      />
      <ChoiceGroup
        label="Zona waktu"
        name="timezone"
        columns={3}
        options={TIMEZONES}
        defaultValue={initial.timezone}
        error={errors.timezone}
      />
      <Input
        label="Nomor WA kamu"
        name="phone"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder="0812 3456 7890"
        hint="Untuk info akun dan tagihan. Tidak kami sebar."
        defaultValue={initial.phone}
        error={errors.phone}
        required
      />
      <Button type="submit" fullWidth disabled={pending} aria-busy={pending}>
        {pending ? "Menyimpan…" : "Lanjut"}
      </Button>
    </form>
  );
}
