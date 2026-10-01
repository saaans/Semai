"use client";

import { useActionState, useEffect } from "react";
import { FormAlert } from "@/app/(auth)/_components/form-alert";
import { SubmitButton } from "@/app/(auth)/_components/submit-button";
import { Input } from "@/components/ui/input";
import { Sheet } from "../_components/sheet";
import { ReasonField, SelectField } from "../gaji/_components/fields";
import { batalkanKasbon, tambahKasbon, type KasbonState } from "./actions";

function KasbonForm({ employees, today, onDone }: { employees: { id: string; name: string }[]; today: string; onDone: () => void }) {
  const [state, action] = useActionState<KasbonState, FormData>(tambahKasbon, {});
  useEffect(() => {
    if (state.saved) onDone();
  }, [state.saved, onDone]);

  return (
    <form action={action} className="flex flex-col gap-4">
      {state.message && <FormAlert tone="error">{state.message}</FormAlert>}
      <SelectField
        label="Karyawan"
        name="employeeId"
        options={employees.map((e) => ({ value: e.id, label: e.name }))}
        error={state.errors?.employeeId}
      />
      <div className="grid grid-cols-2 gap-3">
        <Input label="Nominal kasbon" name="amount" inputMode="numeric" required placeholder="500.000" error={state.errors?.amount} />
        <Input
          label="Cicilan per gajian"
          name="installment"
          inputMode="numeric"
          required
          placeholder="250.000"
          error={state.errors?.installment}
        />
      </div>
      <Input label="Tanggal" name="givenOn" type="date" required max={today} defaultValue={today} error={state.errors?.givenOn} />
      <Input label="Catatan (opsional)" name="note" maxLength={200} placeholder="Contoh: biaya sekolah anak" error={state.errors?.note} />
      <p className="text-sm text-ash">
        Cicilan dipotong otomatis setiap gajian dikunci sampai lunas. Kalau gaji tidak cukup, sisanya dipotong di gajian berikutnya.
      </p>
      <SubmitButton pendingText="Menyimpan…">Catat kasbon</SubmitButton>
    </form>
  );
}

export function KasbonButton({ employees, today }: { employees: { id: string; name: string }[]; today: string }) {
  return (
    <Sheet label="Catat kasbon" title="Catat kasbon" savedText="Kasbon dicatat">
      {(done) => <KasbonForm employees={employees} today={today} onDone={done} />}
    </Sheet>
  );
}

function BatalForm({ cashAdvanceId, onDone }: { cashAdvanceId: string; onDone: () => void }) {
  const [state, action] = useActionState<KasbonState, FormData>(batalkanKasbon, {});
  useEffect(() => {
    if (state.saved) onDone();
  }, [state.saved, onDone]);
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="cashAdvanceId" value={cashAdvanceId} />
      {state.message && <FormAlert tone="error">{state.message}</FormAlert>}
      <p className="text-sm text-smoke">Sisa kasbon tidak dipotong lagi. Cicilan yang sudah dipotong di gajian terkunci tidak berubah.</p>
      <ReasonField error={state.errors?.reason} placeholder="Contoh: salah catat nominal" />
      <SubmitButton pendingText="Menyimpan…" arrow={false} variant="secondary">
        Batalkan kasbon
      </SubmitButton>
    </form>
  );
}

export function BatalKasbonButton({ cashAdvanceId, name }: { cashAdvanceId: string; name: string }) {
  return (
    <Sheet label="Batalkan" title="Batalkan kasbon?" subtitle={name} variant="link">
      {(done) => <BatalForm cashAdvanceId={cashAdvanceId} onDone={done} />}
    </Sheet>
  );
}
