import type { ReactNode } from "react";

/** Ikon tahap tumbuh per paket: benih, tunas, tanaman, pohon kecil, pohon rindang, hutan. */
const PATHS: Record<string, ReactNode> = {
  benih: (
    <>
      <path d="M12 19.5c-3 0-4.5-2.2-4.5-4.8 0-3.2 2.4-6 4.5-7.7 2.1 1.7 4.5 4.5 4.5 7.7 0 2.6-1.5 4.8-4.5 4.8Z" />
      <path d="M12 11v5.5" />
    </>
  ),
  tunas: (
    <>
      <path d="M12 21v-8" />
      <path d="M12 13c0-3.3-2.2-5.5-5.5-5.5 0 3.3 2.2 5.5 5.5 5.5Z" />
      <path d="M12 11c0-3.3 2.2-5.5 5.5-5.5 0 3.3-2.2 5.5-5.5 5.5Z" />
      <path d="M8 21h8" />
    </>
  ),
  tumbuh: (
    <>
      <path d="M12 21V4" />
      <path d="M12 15c-.6-2.6-2.6-4-5-4 .6 2.6 2.6 4 5 4Z" />
      <path d="M12 12c.6-2.6 2.6-4 5-4-.6 2.6-2.6 4-5 4Z" />
      <path d="M12 8.5C11.5 6.3 9.8 5 8 5c.5 2.2 2.2 3.5 4 3.5Z" />
      <path d="M8 21h8" />
    </>
  ),
  berkembang: (
    <>
      <circle cx="12" cy="9.5" r="5.5" />
      <path d="M12 21v-6" />
      <path d="M12 17.5l-2-2M12 16.5l2-2" />
      <path d="M8 21h8" />
    </>
  ),
  rindang: (
    <>
      <path d="M7 15.5a3.5 3.5 0 0 1-.6-6.95A5 5 0 0 1 16 6.6a3.75 3.75 0 0 1 1 8.9H7Z" />
      <path d="M12 21v-5.5" />
      <path d="M12 18l-2.5-2.5M12 17.5l2.5-2" />
      <path d="M6 21h12" />
    </>
  ),
  hutan: (
    <>
      <path d="M9 3 4 11h2.5L3 17h12l-3.5-6H14L9 3Z" />
      <path d="M9 17v4" />
      <path d="M17 9l-3 5h1.5l-2 3.5h7l-2-3.5H20L17 9Z" />
      <path d="M17 17.5V21" />
      <path d="M2.5 21h19" />
    </>
  ),
};

export function IkonPaket({ tier, size = 24, className }: { tier: string; size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      {PATHS[tier] ?? PATHS.benih}
    </svg>
  );
}

/** Ukuran ikon per tahap: makin besar paketnya, makin besar tanamannya. */
const TIER_SIZE: Record<string, number> = {
  benih: 32,
  tunas: 36,
  tumbuh: 42,
  berkembang: 48,
  rindang: 54,
  hutan: 60,
};

/** Ikon paket yang ukurannya tumbuh sesuai tahap, rata bawah seperti di tanah. */
export function IkonTumbuh({ tier, className }: { tier: string; className?: string }) {
  return (
    <span className={`flex h-[60px] items-end ${className ?? ""}`}>
      <IkonPaket tier={tier} size={TIER_SIZE[tier] ?? 32} />
    </span>
  );
}
