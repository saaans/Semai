"use client";

import { useActionState, useEffect, useState } from "react";
import { FormAlert } from "@/app/(auth)/_components/form-alert";
import { SubmitButton } from "@/app/(auth)/_components/submit-button";
import { Input } from "@/components/ui/input";
import { formatRupiah } from "@/lib/format";
import type { RuleCalc, RuleKind, TriggerEvent } from "@/lib/payroll/calculate";
import { calcOptions, EVENT_LABEL, KIND_LABEL } from "@/lib/payroll/rules";
import { Sheet } from "../../_components/sheet";
import { ChoiceGroup } from "../../onboarding/_components/choice-group";
import { hapusAturan, simpanAturan, simpanGajiPokok, simpanPengaturan, type FormState } from "../actions";
import { ReasonField, SelectField } from "./fields";

function useDone(state: FormState, onDone: () => void) {
  useEffect(() => {
    if (state.saved) onDone();
  }, [state.saved, onDone]);
}

/** Angka rupiah tanpa "Rp" untuk nilai awal input, contoh "3.000.000". */
function plain(amount: number | null | undefined) {
  return amount == null ? "" : formatRupiah(amount).replace(/^Rp/, "");
}

// -----------------------------------------------------------------------------
// Gaji harian
// -----------------------------------------------------------------------------

const BASIS_OPTIONS = [
  { value: "jadwal", label: "Hari kerja terjadwal", hint: "Gaji pokok ÷ hari kerja di bulan itu" },
  { value: "tetap", label: "Jumlah hari tetap", hint: "Gaji pokok ÷ angka yang sama tiap bulan" },
] as const;

export function GajiHarianForm({ dayBasis, fixedDays }: { dayBasis: string; fixedDays: number }) {
  const [state, action] = useActionState<FormState, FormData>(simpanPengaturan, {});
  const [basis, setBasis] = useState(dayBasis);
  return (
    <form action={action} className="flex flex-col gap-4">
      {state.message && <FormAlert tone="error">{state.message}</FormAlert>}
      {state.saved && <FormAlert tone="success">Pengaturan gaji harian disimpan.</FormAlert>}
      <ChoiceGroup label="Cara hitung gaji harian" name="dayBasis" options={BASIS_OPTIONS} value={basis} onChange={setBasis} />
      {basis === "tetap" ? (
        <Input
          label="Jumlah hari"
          name="fixedDays"
          type="number"
          inputMode="numeric"
          min={20}
          max={31}
          defaultValue={fixedDays}
          hint="Umumnya 26 (6 hari kerja) atau 30."
          error={state.errors?.fixedDays}
        />
      ) : (
        <input type="hidden" name="fixedDays" value={fixedDays} />
      )}
      <div className="sm:max-w-xs">
        <SubmitButton pendingText="Menyimpan…" arrow={false} variant="secondary">
          Simpan
        </SubmitButton>
      </div>
    </form>
  );
}

// -----------------------------------------------------------------------------
// Gaji pokok
// -----------------------------------------------------------------------------

function GajiPokokForm({ employeeId, amount, onDone }: { employeeId: string; amount: number; onDone: () => void }) {
  const [state, action] = useActionState<FormState, FormData>(simpanGajiPokok, {});
  useDone(state, onDone);
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="employeeId" value={employeeId} />
      {state.message && <FormAlert tone="error">{state.message}</FormAlert>}
      <Input
        label="Gaji pokok per bulan"
        name="amount"
        inputMode="numeric"
        required
        defaultValue={plain(amount)}
        placeholder="3.000.000"
        error={state.errors?.amount}
      />
      <ReasonField error={state.errors?.reason} placeholder="Contoh: naik gaji setelah 1 tahun kerja" />
      <SubmitButton pendingText="Menyimpan…">Simpan gaji pokok</SubmitButton>
    </form>
  );
}

export function GajiPokokButton({ employeeId, name, amount }: { employeeId: string; name: string; amount: number }) {
  return (
    <Sheet label="Ubah" title="Ubah gaji pokok" subtitle={name} variant="link" savedText="Tersimpan">
      {(done) => <GajiPokokForm employeeId={employeeId} amount={amount} onDone={done} />}
    </Sheet>
  );
}

// -----------------------------------------------------------------------------
// Komponen gaji
// -----------------------------------------------------------------------------

export type RuleValue = {
  id: string;
  kind: RuleKind;
  name: string;
  calc: RuleCalc;
  amount: number | null;
  triggerEvent: TriggerEvent | null;
  employeeId: string | null;
  isActive: boolean;
};

const KIND_OPTIONS = (["tunjangan", "lembur", "potongan"] as const).map((k) => ({ value: k, label: KIND_LABEL[k] }));
const EVENT_OPTIONS = (["telat", "pulang_cepat", "alpa"] as const).map((e) => ({ value: e, label: EVENT_LABEL[e] }));

const CALC_HINT: Partial<Record<RuleCalc, string>> = {
  per_jam: "Dihitung per menit lembur yang disetujui. 90 menit = 1,5 jam.",
  proporsional_gaji_harian: "Gaji harian mengikuti pengaturan di bawah halaman ini.",
};

function AturanForm({
  rule,
  employees,
  onDone,
}: {
  rule?: RuleValue;
  employees: { id: string; name: string }[];
  onDone: () => void;
}) {
  const [state, action] = useActionState<FormState, FormData>(simpanAturan, {});
  useDone(state, onDone);

  const [kind, setKind] = useState<RuleKind>(rule?.kind ?? "tunjangan");
  const [event, setEvent] = useState<TriggerEvent>(rule?.triggerEvent ?? "telat");
  const options = calcOptions(kind, kind === "potongan" ? event : null);
  const [calc, setCalc] = useState<string>(rule?.calc ?? options[0]!.value);
  const calcValue = options.some((o) => o.value === calc) ? calc : options[0]!.value;
  const proportional = calcValue === "proporsional_gaji_harian";

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="ruleId" value={rule?.id ?? ""} />
      {state.message && <FormAlert tone="error">{state.message}</FormAlert>}
      <ChoiceGroup
        label="Jenis"
        name="kind"
        options={KIND_OPTIONS}
        value={kind}
        onChange={(v) => setKind(v as RuleKind)}
        columns={3}
        error={state.errors?.kind}
      />
      {kind === "potongan" && (
        <ChoiceGroup
          label="Potongan untuk"
          name="triggerEvent"
          options={EVENT_OPTIONS}
          value={event}
          onChange={(v) => setEvent(v as TriggerEvent)}
          columns={3}
          error={state.errors?.triggerEvent}
        />
      )}
      <Input
        label="Nama"
        name="name"
        required
        maxLength={60}
        defaultValue={rule?.name}
        placeholder={kind === "tunjangan" ? "Uang makan" : kind === "lembur" ? "Lembur per jam" : "Potongan telat"}
        error={state.errors?.name}
      />
      <ChoiceGroup
        label="Cara hitung"
        name="calc"
        options={options}
        value={calcValue}
        onChange={setCalc}
        columns={options.length === 3 ? 3 : 2}
        error={state.errors?.calc}
      />
      {CALC_HINT[calcValue as RuleCalc] && <p className="-mt-2 text-sm text-ash">{CALC_HINT[calcValue as RuleCalc]}</p>}
      {!proportional && (
        <Input
          label="Nominal"
          name="amount"
          inputMode="numeric"
          required
          defaultValue={plain(rule?.amount)}
          placeholder="25.000"
          error={state.errors?.amount}
        />
      )}
      <SelectField
        label="Berlaku untuk"
        name="employeeId"
        defaultValue={rule?.employeeId ?? ""}
        options={[{ value: "", label: "Semua karyawan" }, ...employees.map((e) => ({ value: e.id, label: e.name }))]}
        error={state.errors?.employeeId}
      />
      <label className="flex min-h-11 items-center gap-3 text-sm text-ink">
        <input type="checkbox" name="isActive" defaultChecked={rule?.isActive ?? true} className="size-5 accent-ink" />
        Aktif, ikut dihitung di gajian
      </label>
      {rule && (
        <ReasonField error={state.errors?.reason} label="Alasan perubahan" placeholder="Contoh: harga makan naik" />
      )}
      <SubmitButton pendingText="Menyimpan…">{rule ? "Simpan perubahan" : "Tambah komponen"}</SubmitButton>
    </form>
  );
}

export function AturanButton({
  rule,
  employees,
}: {
  rule?: RuleValue;
  employees: { id: string; name: string }[];
}) {
  return (
    <Sheet
      label={rule ? "Ubah" : "Tambah komponen"}
      title={rule ? "Ubah komponen gaji" : "Tambah komponen gaji"}
      subtitle={rule?.name}
      variant={rule ? "link" : "button"}
      savedText="Tersimpan"
    >
      {(done) => <AturanForm rule={rule} employees={employees} onDone={done} />}
    </Sheet>
  );
}

function HapusAturanForm({ ruleId, onDone }: { ruleId: string; onDone: () => void }) {
  const [state, action] = useActionState<FormState, FormData>(hapusAturan, {});
  useDone(state, onDone);
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="ruleId" value={ruleId} />
      {state.message && <FormAlert tone="error">{state.message}</FormAlert>}
      <p className="text-sm text-smoke">Gajian yang sudah dikunci tidak berubah. Komponen ini tidak dihitung lagi di gajian berikutnya.</p>
      <ReasonField error={state.errors?.reason} placeholder="Contoh: tunjangan transport dihapus mulai bulan ini" />
      <SubmitButton pendingText="Menghapus…" arrow={false} variant="secondary">
        Hapus komponen
      </SubmitButton>
    </form>
  );
}

export function HapusAturanButton({ ruleId, name }: { ruleId: string; name: string }) {
  return (
    <Sheet label="Hapus" title="Hapus komponen gaji?" subtitle={name} variant="link">
      {(done) => <HapusAturanForm ruleId={ruleId} onDone={done} />}
    </Sheet>
  );
}
