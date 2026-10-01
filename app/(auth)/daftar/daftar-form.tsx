"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { daftar, type FormState } from "../actions";
import { FormAlert } from "../_components/form-alert";
import { SubmitButton } from "../_components/submit-button";

export function DaftarForm() {
  const [state, action] = useActionState<FormState, FormData>(daftar, {});
  const v = state.values ?? {};
  const e = state.errors ?? {};

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      {state.message && <FormAlert tone="error">{state.message}</FormAlert>}
      <Input
        label="Nama"
        name="fullName"
        autoComplete="name"
        defaultValue={v.fullName}
        error={e.fullName}
        required
      />
      <Input
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        defaultValue={v.email}
        error={e.email}
        required
      />
      <Input
        label="Nomor WA"
        name="phone"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder="0812 3456 7890"
        hint="Untuk info akun dan tagihan. Tidak kami sebar."
        defaultValue={v.phone}
        error={e.phone}
        required
      />
      <Input
        label="Password"
        name="password"
        type="password"
        autoComplete="new-password"
        hint="Minimal 8 karakter."
        error={e.password}
        required
      />
      <SubmitButton pendingText="Membuat akun…">Buat akun</SubmitButton>
    </form>
  );
}
