"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { lupaPassword, type FormState } from "../actions";
import { FormAlert } from "../_components/form-alert";
import { SubmitButton } from "../_components/submit-button";

export function LupaPasswordForm() {
  const [state, action] = useActionState<FormState, FormData>(lupaPassword, {});

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      {state.message && <FormAlert tone="error">{state.message}</FormAlert>}
      {state.success && <FormAlert tone="success">{state.success}</FormAlert>}
      <Input
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        defaultValue={state.values?.email}
        error={state.errors?.email}
        required
      />
      <SubmitButton pendingText="Mengirim…">Kirim tautan atur ulang</SubmitButton>
    </form>
  );
}
