"use client";

import { FormAlert } from "@/app/(auth)/_components/form-alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EMPLOYEE_RANGES } from "@/lib/onboarding/defaults";
import { simpanUkuranUsaha } from "../actions";
import { ChoiceGroup } from "./choice-group";
import { useStepForm } from "./use-step-form";

export function UkuranForm({
  initial,
}: {
  initial: { employeeRange: string | null; branchCount: number };
}) {
  const { state, pending, onSubmit } = useStepForm(simpanUkuranUsaha);
  const errors = state.errors ?? {};

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
      {state.message && <FormAlert tone="error">{state.message}</FormAlert>}
      <ChoiceGroup
        label="Jumlah karyawan"
        name="employeeRange"
        columns={3}
        options={EMPLOYEE_RANGES.map((r) => ({ value: r.value, label: r.label }))}
        defaultValue={initial.employeeRange}
        error={errors.employeeRange}
      />
      <Input
        label="Jumlah cabang"
        name="branchCount"
        type="number"
        inputMode="numeric"
        min={1}
        max={50}
        defaultValue={initial.branchCount}
        hint="Termasuk tempat usaha utama. Isi 1 kalau hanya satu tempat."
        error={errors.branchCount}
        required
      />
      <Button type="submit" fullWidth disabled={pending} aria-busy={pending}>
        {pending ? "Menyimpan…" : "Lanjut"}
      </Button>
    </form>
  );
}
