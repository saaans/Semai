"use client";

import { useActionState, useEffect, useState } from "react";
import { FormAlert } from "@/app/(auth)/_components/form-alert";
import { SubmitButton } from "@/app/(auth)/_components/submit-button";
import { ReasonField, SelectField } from "@/app/owner/gaji/_components/fields";
import { Sheet } from "@/app/owner/_components/sheet";
import { Input } from "@/components/ui/input";
import {
  aturDiskon,
  hapusDiskon,
  perpanjangTrial,
  ubahPaket,
  ubahSuspend,
  type AdminActionState,
} from "../actions";

type Action = (prev: AdminActionState, formData: FormData) => Promise<AdminActionState>;

export type PlanOption = {
  code: string;
  name: string;
  priceMonthly: number | null;
  priceYearly: number | null;
};

/** Form di dalam Sheet: tutup setelah berhasil, tampilkan error per field. */
function ActionForm({
  action,
  companyId,
  done,
  submitLabel,
  pendingText,
  danger,
  children,
}: {
  action: Action;
  companyId: string;
  done: () => void;
  submitLabel: string;
  pendingText: string;
  danger?: string;
  children: (errors: Record<string, string>) => React.ReactNode;
}) {
  const [state, formAction] = useActionState<AdminActionState, FormData>(action, {});
  useEffect(() => {
    if (state.ok) done();
  }, [state.ok, done]);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="companyId" value={companyId} />
      {children(state.errors ?? {})}
      {danger && <p className="text-sm text-graphite">{danger}</p>}
      {state.message && <FormAlert tone="error">{state.message}</FormAlert>}
      {state.errors?.companyId && <FormAlert tone="error">{state.errors.companyId}</FormAlert>}
      <SubmitButton pendingText={pendingText}>{submitLabel}</SubmitButton>
    </form>
  );
}

function defaultPeriodEnd(cycle: string): string {
  const d = new Date();
  if (cycle === "tahunan") d.setFullYear(d.getFullYear() + 1);
  else d.setMonth(d.getMonth() + 1);
  return d.toISOString().slice(0, 10);
}

function UbahPaketForm({
  companyId,
  plans,
  currentPlan,
  done,
}: {
  companyId: string;
  plans: PlanOption[];
  currentPlan: string;
  done: () => void;
}) {
  const [planCode, setPlanCode] = useState(currentPlan);
  const [cycle, setCycle] = useState("bulanan");
  const plan = plans.find((p) => p.code === planCode);
  const benih = planCode === "benih";
  const normalPrice = cycle === "tahunan" ? plan?.priceYearly : plan?.priceMonthly;

  return (
    <ActionForm
      action={ubahPaket}
      companyId={companyId}
      done={done}
      submitLabel="Ubah paket"
      pendingText="Menyimpan…"
      danger={
        benih
          ? "Langganan berjalan dihentikan sekarang. Karyawan di atas batas Benih disembunyikan setelah 14 hari, tidak dihapus."
          : "Langganan berjalan diganti paket ini mulai sekarang, tanpa tagihan (pembayaran manual)."
      }
    >
      {(errors) => (
        <>
          <SelectField
            label="Paket"
            name="planCode"
            value={planCode}
            onChange={setPlanCode}
            options={plans.map((p) => ({ value: p.code, label: p.name }))}
            error={errors.planCode}
          />
          {!benih && (
            <>
              <SelectField
                label="Siklus"
                name="cycle"
                value={cycle}
                onChange={setCycle}
                options={[
                  { value: "bulanan", label: "Bulanan" },
                  { value: "tahunan", label: "Tahunan" },
                ]}
                error={errors.cycle}
              />
              <Input
                key={cycle}
                label="Aktif sampai"
                name="periodEnd"
                type="date"
                defaultValue={defaultPeriodEnd(cycle)}
                hint="Paket berlaku sampai akhir hari ini (WIB)."
                error={errors.periodEnd}
                required
              />
              <Input
                label="Harga per periode (opsional)"
                name="price"
                inputMode="numeric"
                placeholder={normalPrice != null ? String(normalPrice) : "Wajib untuk harga custom"}
                hint={
                  normalPrice != null
                    ? "Kosongkan untuk harga normal. Dipakai untuk MRR dan prorata upgrade."
                    : "Paket ini harga custom, isi nominal per periode."
                }
                error={errors.price}
              />
            </>
          )}
          <ReasonField placeholder="Contoh: bayar transfer BCA 1 Okt" error={errors.reason} hint="Tercatat di audit log." />
        </>
      )}
    </ActionForm>
  );
}

export function UbahPaketButton(props: { companyId: string; plans: PlanOption[]; currentPlan: string }) {
  return (
    <Sheet label="Ubah paket" title="Ubah paket" subtitle="Tanpa tagihan, langsung berlaku." savedText="Paket diubah">
      {(done) => <UbahPaketForm {...props} done={done} />}
    </Sheet>
  );
}

export function PerpanjangTrialButton({ companyId, hint }: { companyId: string; hint: string }) {
  return (
    <Sheet label="Perpanjang trial" title="Perpanjang trial" subtitle={hint} savedText="Trial diperpanjang">
      {(done) => (
        <ActionForm action={perpanjangTrial} companyId={companyId} done={done} submitLabel="Perpanjang trial" pendingText="Menyimpan…">
          {(errors) => (
            <>
              <Input
                label="Tambah berapa hari"
                name="days"
                type="number"
                inputMode="numeric"
                min={1}
                max={30}
                defaultValue={7}
                hint="1 sampai 30 hari."
                error={errors.days}
                required
              />
              <ReasonField placeholder="Contoh: owner baru sempat setup minggu ini" error={errors.reason} hint="Tercatat di audit log." />
            </>
          )}
        </ActionForm>
      )}
    </Sheet>
  );
}

export function DiskonButton({ companyId, hasDiscount }: { companyId: string; hasDiscount: boolean }) {
  return (
    <>
      <Sheet
        label={hasDiscount ? "Ubah diskon" : "Beri diskon"}
        title={hasDiscount ? "Ubah diskon" : "Beri diskon"}
        subtitle="Berlaku untuk tagihan berikutnya yang dibuat owner."
        savedText="Diskon disimpan"
      >
        {(done) => (
          <ActionForm action={aturDiskon} companyId={companyId} done={done} submitLabel="Simpan diskon" pendingText="Menyimpan…">
            {(errors) => (
              <>
                <Input
                  label="Diskon (%)"
                  name="percent"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={100}
                  placeholder="20"
                  error={errors.percent}
                  required
                />
                <Input
                  label="Berlaku sampai (opsional)"
                  name="until"
                  type="date"
                  hint="Kosongkan kalau tanpa batas waktu."
                  error={errors.until}
                />
                <ReasonField placeholder="Contoh: pilot 5 usaha pertama" error={errors.reason} hint="Tercatat di audit log." />
              </>
            )}
          </ActionForm>
        )}
      </Sheet>
      {hasDiscount && (
        <Sheet label="Hapus diskon" title="Hapus diskon" variant="link" savedText="Diskon dihapus">
          {(done) => (
            <ActionForm action={hapusDiskon} companyId={companyId} done={done} submitLabel="Hapus diskon" pendingText="Menghapus…">
              {(errors) => <ReasonField placeholder="Contoh: masa promo selesai" error={errors.reason} hint="Tercatat di audit log." />}
            </ActionForm>
          )}
        </Sheet>
      )}
    </>
  );
}

export function SuspendButton({ companyId, suspended }: { companyId: string; suspended: boolean }) {
  return (
    <Sheet
      label={suspended ? "Aktifkan lagi" : "Tangguhkan usaha"}
      title={suspended ? "Aktifkan usaha lagi" : "Tangguhkan usaha"}
      savedText={suspended ? "Usaha diaktifkan" : "Usaha ditangguhkan"}
    >
      {(done) => (
        <ActionForm
          action={ubahSuspend}
          companyId={companyId}
          done={done}
          submitLabel={suspended ? "Aktifkan lagi" : "Tangguhkan"}
          pendingText="Menyimpan…"
          danger={
            suspended
              ? "Owner dan admin bisa mengubah data lagi."
              : "Owner dan admin tidak bisa mengubah data apa pun sampai diaktifkan lagi. Absen karyawan tetap jalan."
          }
        >
          {(errors) => (
            <>
              <input type="hidden" name="suspended" value={suspended ? "0" : "1"} />
              <ReasonField
                placeholder={suspended ? "Contoh: sudah klarifikasi dengan owner" : "Contoh: laporan penyalahgunaan"}
                error={errors.reason}
                hint="Tercatat di audit log."
              />
            </>
          )}
        </ActionForm>
      )}
    </Sheet>
  );
}
