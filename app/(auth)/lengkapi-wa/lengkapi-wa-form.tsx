"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { simpanNomorWa, type FormState } from "../actions";
import { FormAlert } from "../_components/form-alert";
import { SubmitButton } from "../_components/submit-button";

export function LengkapiWaForm() {
  const [state, action] = useActionState<FormState, FormData>(simpanNomorWa, {});

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      {state.message && <FormAlert tone="error">{state.message}</FormAlert>}
      <Input
        label="Nomor WA"
        name="phone"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder="0812 3456 7890"
        hint="Untuk info akun dan tagihan. Tidak kami sebar."
        defaultValue={state.values?.phone}
        error={state.errors?.phone}
        required
        autoFocus
      />
      <SubmitButton pendingText="Menyimpan…">Lanjut</SubmitButton>
    </form>
  );
}
