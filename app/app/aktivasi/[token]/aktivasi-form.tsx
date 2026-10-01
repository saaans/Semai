"use client";

import { useActionState } from "react";
import { FormAlert } from "@/app/(auth)/_components/form-alert";
import { SubmitButton } from "@/app/(auth)/_components/submit-button";
import { aktivasi, type FormState } from "../../actions";
import { PinInput } from "../../_components/pin-input";

export function AktivasiForm({
  token,
  needsExistingPin,
}: {
  token: string;
  needsExistingPin: boolean;
}) {
  const [state, action] = useActionState<FormState, FormData>(aktivasi, {});

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      {state.message && <FormAlert tone="error">{state.message}</FormAlert>}
      <input type="hidden" name="token" value={token} />
      {needsExistingPin ? (
        <PinInput
          label="PIN kamu"
          name="pin"
          autoComplete="current-password"
          hint="Nomor ini sudah dipakai absen di usaha lain. Masukkan PIN yang biasa kamu pakai."
          error={state.errors?.pin}
          required
        />
      ) : (
        <>
          <PinInput
            label="Buat PIN 6 angka"
            name="pin"
            autoComplete="new-password"
            hint="Dipakai setiap kali masuk. Hindari tanggal lahir atau angka berurutan."
            error={state.errors?.pin}
            required
          />
          <PinInput
            label="Ulangi PIN"
            name="confirm"
            autoComplete="new-password"
            error={state.errors?.confirm}
            required
          />
        </>
      )}
      <SubmitButton pendingText="Mengaktifkan…">
        {needsExistingPin ? "Sambungkan akun" : "Aktifkan akun"}
      </SubmitButton>
    </form>
  );
}
