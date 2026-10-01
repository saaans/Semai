"use client";

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";

const triggerClass = {
  link: "min-h-11 rounded-button px-2 text-sm text-graphite underline underline-offset-4 hover:text-ink",
  button: "min-h-11 rounded-button border border-stone px-4 text-sm text-ink hover:border-graphite hover:bg-taupe",
} as const;

/**
 * Tombol yang membuka lembar bawah (HP) atau dialog (laptop). Isi dibuat
 * ulang tiap dibuka supaya pesan form lama hilang. `children` menerima
 * fungsi `done` untuk menutup setelah berhasil.
 */
export function Sheet({
  label,
  title,
  subtitle,
  variant = "button",
  triggerClassName,
  savedText,
  children,
}: {
  label: ReactNode;
  title: string;
  subtitle?: string;
  variant?: keyof typeof triggerClass;
  /** Ganti gaya tombol pembuka, contoh tombol mengambang. */
  triggerClassName?: string;
  /** Teks singkat setelah berhasil, contoh "Tersimpan". */
  savedText?: string;
  children: (done: () => void) => ReactNode;
}) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [openCount, setOpenCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) dialog.showModal();
    if (!isOpen && dialog.open) dialog.close();
  }, [isOpen]);

  const open = () => {
    setOpenCount((n) => n + 1);
    setSaved(false);
    setIsOpen(true);
  };
  const close = () => setIsOpen(false);
  const done = useCallback(() => {
    setSaved(true);
    setIsOpen(false);
  }, []);

  return (
    <>
      <button type="button" onClick={open} className={triggerClassName ?? triggerClass[variant]}>
        {label}
      </button>
      {saved && savedText && (
        <span role="status" className="text-xs text-smoke">
          {savedText}
        </span>
      )}
      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        onClose={close}
        className="mx-auto mt-auto mb-0 max-h-[90dvh] w-full max-w-full overflow-y-auto rounded-t-card bg-canvas p-5 text-ink backdrop:bg-ink/40 sm:my-auto sm:max-w-lg sm:rounded-card"
        onClick={(event) => {
          if (event.target === event.currentTarget) close();
        }}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 id={titleId} className="text-2xl">
              {title}
            </h2>
            {subtitle && <p className="text-sm text-smoke">{subtitle}</p>}
          </div>
          <button type="button" onClick={close} className="min-h-11 rounded-button px-2 text-sm text-graphite hover:bg-taupe">
            Tutup
          </button>
        </div>
        {openCount > 0 && <div key={openCount}>{children(done)}</div>}
      </dialog>
    </>
  );
}
