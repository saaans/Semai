"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { aturPasswordBaru, type FormState } from "../actions";
import { FormAlert } from "../_components/form-alert";
import { SubmitButton } from "../_components/submit-button";

export function AturPasswordForm() {
  const [state, action] = useActionState<FormState, FormData>(aturPasswordBaru, {});

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      {state.message && <FormAlert tone="error">{state.message}</FormAlert>}
      <Input
        label="Password baru"
        name="password"
        type="password"
        autoComplete="new-password"
        hint="Minimal 8 karakter."
        error={state.errors?.password}
        required
      />
      <Input
        label="Ulangi password baru"
        name="confirm"
        type="password"
        autoComplete="new-password"
        error={state.errors?.confirm}
        required
      />
      <SubmitButton pendingText="Menyimpan…">Simpan password</SubmitButton>
    </form>
  );
}
