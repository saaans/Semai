"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { masuk, type FormState } from "../actions";
import { FormAlert } from "../_components/form-alert";
import { ResendVerification } from "../_components/resend-verification";
import { SubmitButton } from "../_components/submit-button";

export function MasukForm({ next }: { next: string | null }) {
  const [state, action] = useActionState<FormState, FormData>(masuk, {});
  const v = state.values ?? {};
  const e = state.errors ?? {};

  return (
    <div className="flex flex-col gap-4">
      <form action={action} className="flex flex-col gap-4" noValidate>
        {next && <input type="hidden" name="next" value={next} />}
        {state.message && <FormAlert tone="error">{state.message}</FormAlert>}
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
        <div className="flex flex-col gap-1.5">
          <Input
            label="Password"
            name="password"
            type="password"
            autoComplete="current-password"
            error={e.password}
            required
          />
          <Link
            href="/lupa-password"
            className="self-end text-sm text-graphite underline underline-offset-4"
          >
            Lupa password?
          </Link>
        </div>
        <SubmitButton pendingText="Memeriksa…">Masuk</SubmitButton>
      </form>
      {state.unverifiedEmail && <ResendVerification email={state.unverifiedEmail} />}
    </div>
  );
}
