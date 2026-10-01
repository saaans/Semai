"use client";

import { useActionState, useEffect, useState } from "react";
import { FormAlert } from "@/app/(auth)/_components/form-alert";
import { SubmitButton } from "@/app/(auth)/_components/submit-button";
import { Input } from "@/components/ui/input";
import { Sheet } from "../../_components/sheet";
import { ChoiceGroup } from "../../onboarding/_components/choice-group";
import { hapusPenyesuaian, tambahPenyesuaian, type FormState } from "../actions";
import { ReasonField } from "./fields";

const DIRECTIONS = [
  { value: "tambah", label: "Tambah gaji" },
  { value: "kurang", label: "Kurangi gaji" },
] as const;

function PenyesuaianForm({ employeeId, month, onDone }: { employeeId: string; month: string; onDone: () => void }) {
  const [state, action] = useActionState<FormState, FormData>(tambahPenyesuaian, {});
  const [direction, setDirection] = useState("tambah");

  useEffect(() => {
    if (state.saved) onDone();
  }, [state.saved, onDone]);

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="employeeId" value={employeeId} />
      <input type="hidden" name="month" value={month} />
      {state.message && <FormAlert tone="error">{state.message}</FormAlert>}
      <ChoiceGroup label="Jenis" name="direction" options={DIRECTIONS} value={direction} onChange={setDirection} error={state.errors?.direction} />
      <Input
        label="Nominal"
        name="amount"
        inputMode="numeric"
        placeholder="150.000"
        required
        error={state.errors?.amount}
      />
      <ReasonField
        error={state.errors?.reason}
        placeholder="Contoh: lembur 28 Sep belum masuk gajian September"
        hint="Terlihat di slip gaji karyawan."
      />
      <SubmitButton pendingText="Menyimpan…">Simpan penyesuaian</SubmitButton>
    </form>
  );
}

/** Tambah penyesuaian (+/−) untuk satu karyawan di bulan yang belum dikunci. */
export function PenyesuaianButton({ employeeId, employeeName, month }: { employeeId: string; employeeName: string; month: string }) {
  return (
    <Sheet label="Tambah penyesuaian" title="Penyesuaian gaji" subtitle={employeeName} variant="link" savedText="Tersimpan">
      {(done) => <PenyesuaianForm employeeId={employeeId} month={month} onDone={done} />}
    </Sheet>
  );
}

export function HapusPenyesuaianButton({ adjustmentId }: { adjustmentId: string }) {
  const [state, action] = useActionState<FormState, FormData>(hapusPenyesuaian, {});
  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="adjustmentId" value={adjustmentId} />
      <button type="submit" className="min-h-11 rounded-button px-2 text-xs text-graphite underline underline-offset-4 hover:text-ink">
        Hapus
      </button>
      {state.message && <span className="text-xs text-danger">{state.message}</span>}
    </form>
  );
}
