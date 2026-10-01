"use client";

import { useActionState, useEffect } from "react";
import { FormAlert } from "@/app/(auth)/_components/form-alert";
import { SubmitButton } from "@/app/(auth)/_components/submit-button";
import { Sheet } from "../../_components/sheet";
import { kunciGajian, type FormState } from "../actions";

function KunciForm({
  month,
  expectedNet,
  summary,
  warnings,
  onDone,
}: {
  month: string;
  expectedNet: number;
  summary: string;
  warnings: string[];
  onDone: () => void;
}) {
  const [state, action] = useActionState<FormState, FormData>(kunciGajian, {});

  useEffect(() => {
    if (state.saved) onDone();
  }, [state.saved, onDone]);

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="month" value={month} />
      <input type="hidden" name="expectedNet" value={expectedNet} />
      {state.message && <FormAlert tone="error">{state.message}</FormAlert>}
      <p className="text-sm text-graphite">{summary}</p>
      <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm text-smoke">
        <li>Slip gaji jadi terlihat oleh karyawan dan bisa dikirim lewat WA.</li>
        <li>Cicilan kasbon dipotong dari saldonya.</li>
        <li>Absen dan gaji bulan ini tidak bisa diubah lagi. Koreksi dicatat sebagai penyesuaian di bulan berikutnya.</li>
        {warnings.map((w) => (
          <li key={w} className="text-graphite">
            {w}
          </li>
        ))}
      </ul>
      <SubmitButton pendingText="Mengunci…">Kunci gajian</SubmitButton>
    </form>
  );
}

/** Konfirmasi kunci gajian. */
export function KunciGajianButton(props: { month: string; monthLabel: string; expectedNet: number; summary: string; warnings: string[] }) {
  return (
    <Sheet label="Kunci gajian" title={`Kunci gajian ${props.monthLabel}?`} variant="button">
      {(done) => <KunciForm {...props} onDone={done} />}
    </Sheet>
  );
}
