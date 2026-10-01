"use client";

import { useId, useState, type ReactNode } from "react";

/**
 * Baris aksi gajian per karyawan: tombol "Lihat rincian" sejajar dengan aksi
 * lain, rinciannya terbuka di bawah baris.
 */
export function RincianToggle({ actions, children }: { actions?: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div className="flex flex-col">
      <div className="-my-1 flex flex-wrap items-center gap-x-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={id}
          className="flex min-h-11 items-center gap-1 text-sm text-graphite hover:text-ink"
        >
          {open ? "Tutup rincian" : "Lihat rincian"}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden className={open ? "rotate-180 transition-transform" : "transition-transform"}>
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
        {actions}
      </div>
      {open && (
        <div id={id} className="mt-2 rounded-button bg-canvas p-4">
          {children}
        </div>
      )}
    </div>
  );
}
