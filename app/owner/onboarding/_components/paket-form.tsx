"use client";

import { FormAlert } from "@/app/(auth)/_components/form-alert";
import { Button } from "@/components/ui/button";
import { pilihPaket } from "../actions";
import { useStepForm } from "./use-step-form";

/** Tiga pilihan langkah 6. Teks dan kode paket disiapkan halaman (dari tabel plans). */
export function PaketForm({
  paid,
  benihNote,
}: {
  paid: { code: string; label: string };
  benihNote: string;
}) {
  const { state, pending, onSubmit } = useStepForm(pilihPaket);

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      {state.message && <FormAlert tone="error">{state.message}</FormAlert>}
      <input type="hidden" name="planCode" value={paid.code} />
      <Button type="submit" name="choice" value="trial_plus" fullWidth disabled={pending}>
        {pending ? "Menyiapkan usahamu…" : "Coba semua fitur gratis 14 hari"}
      </Button>
      <Button
        type="submit"
        name="choice"
        value="berbayar"
        variant="secondary"
        fullWidth
        disabled={pending}
      >
        {paid.label}
      </Button>
      <Button
        type="submit"
        name="choice"
        value="benih"
        variant="secondary"
        fullWidth
        disabled={pending}
      >
        Lanjut pakai Benih gratis
      </Button>
      <p className="text-sm text-ash">{benihNote}</p>
    </form>
  );
}
