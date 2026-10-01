"use client";

import { useActionState } from "react";
import { FormAlert } from "@/app/(auth)/_components/form-alert";
import { Button } from "@/components/ui/button";
import { ChoiceGroup } from "../onboarding/_components/choice-group";
import { simpanModeAbsen, type PengaturanState } from "./actions";

const MODES = [
  { value: "masuk", label: "Absen masuk saja", hint: "Karyawan cukup absen saat datang" },
  {
    value: "masuk_pulang",
    label: "Absen masuk dan pulang",
    hint: "Pulang juga pakai selfie + lokasi. Lembur bisa dihitung",
  },
] as const;

export function ModeAbsenForm({ initial }: { initial: string }) {
  const [state, action, pending] = useActionState<PengaturanState, FormData>(simpanModeAbsen, {});

  return (
    <form action={action} className="flex flex-col gap-4">
      {state.message && <FormAlert tone="error">{state.message}</FormAlert>}
      {state.saved && <FormAlert tone="success">Pengaturan absen disimpan.</FormAlert>}
      <ChoiceGroup label="Cara absen" name="attendanceMode" options={MODES} defaultValue={initial} />
      <Button type="submit" className="self-start" disabled={pending} aria-busy={pending}>
        {pending ? "Menyimpan…" : "Simpan pengaturan"}
      </Button>
    </form>
  );
}
