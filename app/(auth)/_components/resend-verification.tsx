"use client";

import { useActionState } from "react";
import { kirimUlangVerifikasi, type FormState } from "../actions";
import { FormAlert } from "./form-alert";
import { SubmitButton } from "./submit-button";

/** Tombol kirim ulang tautan verifikasi email. */
export function ResendVerification({ email }: { email: string }) {
  const [state, action] = useActionState<FormState, FormData>(kirimUlangVerifikasi, {});
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="email" value={email} />
      {state.message && <FormAlert tone="error">{state.message}</FormAlert>}
      {state.success && <FormAlert tone="success">{state.success}</FormAlert>}
      <SubmitButton variant="secondary" arrow={false} pendingText="Mengirim…">
        Kirim ulang tautan verifikasi
      </SubmitButton>
    </form>
  );
}
