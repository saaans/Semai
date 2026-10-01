"use client";

import { startTransition, useActionState, type FormEvent } from "react";
import type { FormState } from "../actions";

export type StepAction = (prev: FormState, formData: FormData) => Promise<FormState>;

/**
 * Kirim form onboarding tanpa reset otomatis React 19, supaya isian
 * (termasuk titik peta dan daftar shift) tetap ada saat ada error.
 */
export function useStepForm(action: StepAction) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, {});

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const formData = new FormData(event.currentTarget, submitter);
    startTransition(() => formAction(formData));
  }

  return { state, pending, onSubmit };
}
