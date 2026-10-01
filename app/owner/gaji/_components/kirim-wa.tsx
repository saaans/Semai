"use client";

import { useState, useTransition } from "react";
import { tandaiWaTerkirim } from "../actions";

/**
 * Buka WhatsApp (wa.me) dengan pesan berisi link slip. Link hanya bisa
 * dibuka karyawan setelah masuk dengan PIN.
 */
export function KirimWaButton({
  payslipId,
  href,
  sentLabel,
}: {
  payslipId: string;
  href: string;
  /** "Terkirim 1 Okt" kalau sudah pernah dikirim. */
  sentLabel: string | null;
}) {
  const [, startTransition] = useTransition();
  const [clicked, setClicked] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => {
          setClicked(true);
          startTransition(() => tandaiWaTerkirim(payslipId));
        }}
        className="inline-flex min-h-11 items-center rounded-button border border-stone px-4 text-sm text-ink hover:border-graphite hover:bg-taupe"
      >
        Kirim via WA
      </a>
      {(clicked || sentLabel) && <span className="text-xs text-smoke">{clicked ? "Dibuka di WA" : sentLabel}</span>}
    </div>
  );
}
