"use client";

import { FormAlert } from "@/app/(auth)/_components/form-alert";
import { Button } from "@/components/ui/button";
import { lewatiUndangan } from "../actions";
import { useStepForm } from "./use-step-form";

export function LewatiForm() {
  const { state, pending, onSubmit } = useStepForm(lewatiUndangan);

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      {state.message && <FormAlert tone="error">{state.message}</FormAlert>}
      <Button type="submit" fullWidth disabled={pending} aria-busy={pending}>
        {pending ? "Menyimpan…" : "Lewati dulu"}
      </Button>
    </form>
  );
}
