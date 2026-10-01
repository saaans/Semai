"use client";

import { useActionState, useCallback, useEffect, useRef, useState } from "react";
import { FormAlert } from "@/app/(auth)/_components/form-alert";
import { SubmitButton } from "@/app/(auth)/_components/submit-button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";
import { CORRECTION_STATUSES } from "@/lib/attendance/correction";
import { koreksiAbsen, type KoreksiState } from "../absen/actions";
import { ChoiceGroup } from "../onboarding/_components/choice-group";

export type KoreksiInitial = {
  status: string;
  /** "HH:MM" di zona usaha. */
  clockIn: string;
  clockOut: string;
};

type Props = {
  employeeId: string;
  employeeName: string;
  /** Tanggal tetap. Kosong = owner memilih tanggal (min/max wajib). */
  workDate?: string;
  dateLabel?: string;
  minDate?: string;
  maxDate?: string;
  initial?: KoreksiInitial;
  showClockOut: boolean;
  label?: string;
  variant?: "link" | "button";
};

function KoreksiForm({
  employeeId,
  workDate,
  minDate,
  maxDate,
  initial,
  showClockOut,
  onDone,
}: Props & { onDone: () => void }) {
  const [state, action] = useActionState<KoreksiState, FormData>(koreksiAbsen, {});
  const [status, setStatus] = useState(initial?.status ?? "hadir");

  useEffect(() => {
    if (state.saved) onDone();
  }, [state.saved, onDone]);

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="employeeId" value={employeeId} />
      {workDate ? (
        <input type="hidden" name="workDate" value={workDate} />
      ) : (
        <Input
          label="Tanggal"
          name="workDate"
          type="date"
          required
          min={minDate}
          max={maxDate}
          defaultValue={maxDate}
          error={state.errors?.workDate}
        />
      )}
      {state.message && <FormAlert tone="error">{state.message}</FormAlert>}

      <ChoiceGroup
        label="Status"
        name="status"
        options={CORRECTION_STATUSES}
        value={status}
        onChange={setStatus}
        error={state.errors?.status}
        columns={3}
      />

      {status === "hadir" && (
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Jam masuk"
            name="clockIn"
            type="time"
            required
            defaultValue={initial?.clockIn}
            error={state.errors?.clockIn}
          />
          {showClockOut && (
            <Input
              label="Jam pulang"
              name="clockOut"
              type="time"
              defaultValue={initial?.clockOut}
              hint="Kosongkan kalau belum pulang"
              error={state.errors?.clockOut}
            />
          )}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`alasan-${employeeId}`} className="text-sm font-medium text-graphite">
          Alasan koreksi
        </label>
        <textarea
          id={`alasan-${employeeId}`}
          name="reason"
          required
          minLength={5}
          maxLength={300}
          rows={3}
          placeholder="Contoh: HP karyawan rusak, absen dicatat manual"
          aria-invalid={state.errors?.reason ? true : undefined}
          className={cn(
            "w-full rounded-button border border-stone bg-canvas px-3.5 py-2.5 text-base text-ink placeholder:text-ash hover:border-ash focus:border-ink focus:outline-none",
            state.errors?.reason && "border-danger",
          )}
        />
        {state.errors?.reason ? (
          <p className="text-sm text-danger">{state.errors.reason}</p>
        ) : (
          <p className="text-sm text-ash">Alasan terlihat oleh karyawan dan tercatat di riwayat perubahan.</p>
        )}
      </div>

      <SubmitButton pendingText="Menyimpan…">Simpan koreksi</SubmitButton>
    </form>
  );
}

/**
 * Tombol "Koreksi" yang membuka form di lembar bawah (HP) atau dialog
 * (laptop). Form dibuat ulang tiap dibuka supaya pesan lama hilang.
 */
export function KoreksiButton(props: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [openCount, setOpenCount] = useState(0);
  const [savedName, setSavedName] = useState<string | null>(null);

  const open = () => {
    setOpenCount((n) => n + 1);
    setSavedName(null);
    dialogRef.current?.showModal();
  };
  const close = () => dialogRef.current?.close();
  const done = useCallback(() => {
    setSavedName(props.employeeName);
    dialogRef.current?.close();
  }, [props.employeeName]);

  return (
    <>
      <button
        type="button"
        onClick={open}
        className={
          props.variant === "button"
            ? "min-h-11 rounded-button border border-stone px-4 text-sm text-ink hover:border-graphite hover:bg-taupe"
            : "min-h-11 rounded-button px-2 text-sm text-graphite underline underline-offset-4 hover:text-ink"
        }
      >
        {props.label ?? "Koreksi"}
      </button>
      {savedName && (
        <span role="status" className="text-xs text-smoke">
          Koreksi disimpan
        </span>
      )}
      <dialog
        ref={dialogRef}
        aria-labelledby={`koreksi-${props.employeeId}-${props.workDate ?? "baru"}`}
        className="mx-auto mt-auto mb-0 max-h-[90dvh] w-full max-w-full overflow-y-auto sm:max-w-lg rounded-t-card bg-canvas p-5 text-ink backdrop:bg-ink/40 sm:my-auto sm:rounded-card"
        onClick={(event) => {
          if (event.target === dialogRef.current) close();
        }}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 id={`koreksi-${props.employeeId}-${props.workDate ?? "baru"}`} className="text-2xl">
              Koreksi absen
            </h2>
            <p className="text-sm text-smoke">
              {props.employeeName}
              {props.dateLabel ? ` · ${props.dateLabel}` : ""}
            </p>
          </div>
          <button type="button" onClick={close} className="min-h-11 rounded-button px-2 text-sm text-graphite hover:bg-taupe">
            Tutup
          </button>
        </div>
        {openCount > 0 && <KoreksiForm key={openCount} {...props} onDone={done} />}
      </dialog>
    </>
  );
}
