"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { FormAlert } from "@/app/(auth)/_components/form-alert";
import { Button } from "@/components/ui/button";
import { bayarPaket, mulaiTrialPlus, tutupKartuKuota, turunKeBenih, type PaketState } from "./actions";

function PendingButton({
  children,
  pendingText,
  variant = "primary",
  fullWidth,
}: {
  children: React.ReactNode;
  pendingText: string;
  variant?: "primary" | "secondary";
  fullWidth?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant={variant}
      arrow={variant === "primary"}
      fullWidth={fullWidth}
      disabled={pending}
      aria-busy={pending}
    >
      {pending ? pendingText : children}
    </Button>
  );
}

/** "Coba gratis 14 hari". `next` = halaman tujuan setelah trial dimulai. */
export function TrialButton({ next }: { next?: string }) {
  const [state, action] = useActionState<PaketState, FormData>(mulaiTrialPlus, {});
  return (
    <form action={action} className="flex flex-col gap-2">
      {next && <input type="hidden" name="next" value={next} />}
      <PendingButton pendingText="Memulai trial…">Coba gratis 14 hari</PendingButton>
      {state.message && <FormAlert tone="error">{state.message}</FormAlert>}
    </form>
  );
}

/** Pindah ke Benih dengan konfirmasi dulu. */
export function TurunBenihButton({ planName, warning }: { planName: string; warning: string | null }) {
  const [confirming, setConfirming] = useState(false);
  const [state, action] = useActionState<PaketState, FormData>(turunKeBenih, {});

  if (!confirming) {
    return (
      <Button variant="secondary" arrow={false} onClick={() => setConfirming(true)}>
        Pakai Benih
      </Button>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-3 rounded-button border border-stone bg-canvas p-4">
      <p className="text-sm text-graphite">
        Paket {planName} berhenti sekarang dan usahamu memakai Benih (gratis). Fitur berbayar terkunci
        lagi, data tidak dihapus.
        {warning && ` ${warning}`}
      </p>
      {state.message && <FormAlert tone="error">{state.message}</FormAlert>}
      <div className="flex flex-wrap gap-2">
        <PendingButton variant="secondary" pendingText="Memindahkan…">
          Ya, pakai Benih
        </PendingButton>
        <Button variant="secondary" arrow={false} onClick={() => setConfirming(false)}>
          Batal
        </Button>
      </div>
    </form>
  );
}

export function TutupKuotaButton() {
  return (
    <form action={tutupKartuKuota}>
      <button
        type="submit"
        className="min-h-11 rounded-button px-2 text-sm text-graphite underline underline-offset-4 hover:text-ink"
      >
        Tutup
      </button>
    </form>
  );
}

/** Buat tagihan lalu buka halaman bayar Midtrans (VA atau QRIS). */
export function BayarButton({
  planCode,
  cycle,
  label,
  primary = false,
}: {
  planCode: string;
  cycle: string;
  label: string;
  primary?: boolean;
}) {
  const [state, action] = useActionState<PaketState, FormData>(bayarPaket, {});
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="planCode" value={planCode} />
      <input type="hidden" name="cycle" value={cycle} />
      <PendingButton variant={primary ? "primary" : "secondary"} fullWidth pendingText="Membuka halaman bayar…">
        {label}
      </PendingButton>
      {state.message && <FormAlert tone="error">{state.message}</FormAlert>}
    </form>
  );
}
