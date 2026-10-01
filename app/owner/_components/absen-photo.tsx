"use client";

import { useRef, useState } from "react";

/**
 * Foto absen kecil, ketuk untuk memperbesar. Link pertama dipertahankan
 * selama refresh otomatis (link baru tiap refresh = unduh ulang foto);
 * kalau link lama kedaluwarsa, pakai link terbaru.
 */
export function AbsenPhoto({
  url,
  alt,
  label,
  size = "md",
}: {
  url: string | null;
  alt: string;
  label: string;
  /** sm = bulat kecil tanpa label, untuk baris tabel. */
  size?: "sm" | "md";
}) {
  const [src, setSrc] = useState(url);
  const dialogRef = useRef<HTMLDialogElement>(null);

  if (!src && url) setSrc(url);

  if (!src) {
    return (
      <span className="flex size-14 shrink-0 items-center justify-center rounded-button border border-dashed border-stone text-[10px] text-ash">
        Tanpa foto
      </span>
    );
  }

  const onError = () => {
    if (url && url !== src) setSrc(url);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className={
          size === "sm"
            ? "relative size-10 shrink-0 overflow-hidden rounded-full bg-stone focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            : "relative size-14 shrink-0 overflow-hidden rounded-button bg-stone focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        }
        aria-label={`Lihat foto ${label}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- signed URL bucket privat */}
        <img src={src} alt={alt} loading="lazy" onError={onError} className="size-full object-cover" />
        {size === "md" && (
          <span className="absolute inset-x-0 bottom-0 bg-ink/60 py-0.5 text-center text-[10px] text-canvas">{label}</span>
        )}
      </button>
      <dialog
        ref={dialogRef}
        className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-card bg-canvas p-3 text-ink backdrop:bg-ink/60"
        onClick={(event) => {
          if (event.target === dialogRef.current) dialogRef.current?.close();
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- signed URL bucket privat */}
        <img src={src} alt={alt} onError={onError} className="w-full rounded-button" />
        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="text-sm text-smoke">{alt}</span>
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className="min-h-11 rounded-button border border-stone px-4 text-sm"
          >
            Tutup
          </button>
        </div>
      </dialog>
    </>
  );
}
