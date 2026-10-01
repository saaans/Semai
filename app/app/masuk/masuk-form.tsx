"use client";

import { useActionState } from "react";
import { FormAlert } from "@/app/(auth)/_components/form-alert";
import { SubmitButton } from "@/app/(auth)/_components/submit-button";
import { Input } from "@/components/ui/input";
import { masukKaryawan, type FormState } from "../actions";
import { PinInput } from "../_components/pin-input";

export function MasukKaryawanForm() {
  const [state, action] = useActionState<FormState, FormData>(masukKaryawan, {});

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      {state.message && <FormAlert tone="error">{state.message}</FormAlert>}
      <Input
        label="Nomor HP"
        name="phone"
        type="tel"
        inputMode="tel"
        autoComplete="username"
        placeholder="0812 3456 7890"
        defaultValue={state.values?.phone}
        error={state.errors?.phone}
        required
      />
      <PinInput
        label="PIN"
        name="pin"
        autoComplete="current-password"
        error={state.errors?.pin}
        required
      />
      <SubmitButton pendingText="Memeriksa…">Masuk</SubmitButton>
      <p className="text-sm text-ash">
        Lupa PIN? Minta pemilik usaha reset PIN, lalu buka link baru yang dikirim lewat WA.
      </p>
    </form>
  );
}
