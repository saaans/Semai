"use client";

import { useFormStatus } from "react-dom";

/**
 * Chip panah hitam di kanan tombol utama. Di dalam form yang sedang diproses,
 * panah berganti jadi spinner supaya jelas tombolnya bekerja.
 */
export function ButtonChip() {
  const { pending } = useFormStatus();
  return (
    <span
      aria-hidden
      className="flex size-8 shrink-0 items-center justify-center rounded-[7px] bg-on-accent text-accent transition-transform duration-150 group-hover:translate-x-0.5"
    >
      {pending ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="motion-safe:animate-spin">
          <path d="M12 3a9 9 0 1 0 9 9" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      )}
    </span>
  );
}
