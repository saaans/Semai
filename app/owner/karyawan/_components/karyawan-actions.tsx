"use client";

import { useActionState } from "react";
import { FormAlert } from "@/app/(auth)/_components/form-alert";
import { SubmitButton } from "@/app/(auth)/_components/submit-button";
import {
  batalkanUndangan,
  buatLinkBaru,
  resetPin,
  ubahStatus,
  type KaryawanFormState,
} from "../actions";
import { InviteCard } from "./invite-card";
import { UpgradeCard } from "./upgrade-card";

type Action = (prev: KaryawanFormState, formData: FormData) => Promise<KaryawanFormState>;

function ActionForm({
  action,
  employeeId,
  fields,
  label,
  pendingText,
  confirmText,
  variant = "secondary",
  reset,
  plan,
}: {
  action: Action;
  employeeId: string;
  fields?: Record<string, string>;
  label: string;
  pendingText: string;
  confirmText?: string;
  variant?: "primary" | "secondary";
  reset?: boolean;
  plan: { name: string; limit: number | null };
}) {
  const [state, formAction] = useActionState<KaryawanFormState, FormData>(action, {});

  return (
    <div className="flex flex-col gap-3">
      <form
        action={formAction}
        onSubmit={(event) => {
          if (confirmText && !window.confirm(confirmText)) event.preventDefault();
        }}
      >
        <input type="hidden" name="employeeId" value={employeeId} />
        {Object.entries(fields ?? {}).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}
        <SubmitButton variant={variant} arrow={variant === "primary"} pendingText={pendingText}>
          {label}
        </SubmitButton>
      </form>
      {state.limitReached ? (
        <UpgradeCard planName={plan.name} limit={plan.limit} />
      ) : (
        state.message && <FormAlert tone="error">{state.message}</FormAlert>
      )}
      {state.invite && <InviteCard invite={state.invite} reset={reset} />}
    </div>
  );
}

/** Tombol aksi di halaman detail karyawan, sesuai status. */
export function KaryawanActions({
  employeeId,
  status,
  plan,
}: {
  employeeId: string;
  status: "diundang" | "aktif" | "nonaktif";
  plan: { name: string; limit: number | null };
}) {
  const common = { employeeId, plan };

  if (status === "diundang") {
    return (
      <div className="flex flex-col gap-3">
        <ActionForm
          {...common}
          action={buatLinkBaru}
          variant="primary"
          label="Buat link undangan baru"
          pendingText="Membuat link…"
        />
        <ActionForm
          {...common}
          action={batalkanUndangan}
          label="Batalkan undangan"
          pendingText="Membatalkan…"
          confirmText="Batalkan undangan dan hapus data karyawan ini?"
        />
      </div>
    );
  }

  if (status === "aktif") {
    return (
      <div className="flex flex-col gap-3">
        <ActionForm
          {...common}
          action={resetPin}
          reset
          label="Reset PIN"
          pendingText="Mereset PIN…"
          confirmText="PIN lama langsung tidak berlaku, dan karyawan perlu membuat PIN baru lewat link. Lanjut?"
        />
        <ActionForm
          {...common}
          action={ubahStatus}
          fields={{ status: "nonaktif" }}
          label="Nonaktifkan"
          pendingText="Menonaktifkan…"
          confirmText="Karyawan ini tidak bisa absen lagi di usahamu. Datanya tetap tersimpan. Lanjut?"
        />
      </div>
    );
  }

  return (
    <ActionForm
      {...common}
      action={ubahStatus}
      fields={{ status: "aktif" }}
      label="Aktifkan lagi"
      pendingText="Mengaktifkan…"
    />
  );
}
