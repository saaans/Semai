import type { ReactNode } from "react";

/** Ikon outline menu owner, dipilih dari href. */
const ICONS: Record<string, ReactNode> = {
  "/owner": (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  "/owner/absen": (
    <>
      <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </>
  ),
  "/owner/karyawan": (
    <>
      <circle cx="9" cy="8.5" r="3.5" />
      <path d="M2.5 20c.6-3.4 3.2-5.5 6.5-5.5s5.9 2.1 6.5 5.5" />
      <path d="M15.5 5.2a3.5 3.5 0 0 1 0 6.6M18 14.8c1.9.7 3.1 2.5 3.5 5.2" />
    </>
  ),
  "/owner/gaji": (
    <>
      <rect x="2.5" y="6" width="19" height="12" rx="2.5" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M6 9.5v5M18 9.5v5" />
    </>
  ),
  kasbon: (
    <>
      <path d="M6 3.5h12v17l-3-2-3 2-3-2-3 2v-17Z" />
      <path d="M9 8.5h6M9 12h6" />
    </>
  ),
  shift: (
    <>
      <path d="M4 9a8 8 0 0 1 14-3.5L20 7.5" />
      <path d="M20 3.5v4h-4" />
      <path d="M20 15a8 8 0 0 1-14 3.5L4 16.5" />
      <path d="M4 20.5v-4h4" />
    </>
  ),
  cuti: (
    <>
      <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
      <path d="M3.5 10h17M8 3v4M16 3v4M9.5 13.5l5 4M14.5 13.5l-5 4" />
    </>
  ),
  multi_lokasi: (
    <>
      <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
  export: (
    <>
      <path d="M12 4v11M7.5 10.5 12 15l4.5-4.5" />
      <path d="M4 17v1.5A2.5 2.5 0 0 0 6.5 21h11a2.5 2.5 0 0 0 2.5-2.5V17" />
    </>
  ),
  import_excel: (
    <>
      <path d="M12 15V4M7.5 8.5 12 4l4.5 4.5" />
      <path d="M4 17v1.5A2.5 2.5 0 0 0 6.5 21h11a2.5 2.5 0 0 0 2.5-2.5V17" />
    </>
  ),
  bpjs_pph21: (
    <>
      <path d="M12 3 4.5 6v5.5c0 4.6 3.2 8.2 7.5 9.5 4.3-1.3 7.5-4.9 7.5-9.5V6L12 3Z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  thr: (
    <>
      <rect x="3.5" y="8" width="17" height="4" rx="1" />
      <path d="M5 12v8.5h14V12M12 8v12.5" />
      <path d="M12 8c-1.5-3.5-5.5-3.5-5.5-1S9 8 12 8Zm0 0c1.5-3.5 5.5-3.5 5.5-1S15 8 12 8Z" />
    </>
  ),
  admin_tambahan: (
    <>
      <circle cx="10" cy="8.5" r="3.5" />
      <path d="M3.5 20c.6-3.4 3.2-5.5 6.5-5.5 1.6 0 3 .5 4.1 1.3M18.5 14v6M15.5 17h6" />
    </>
  ),
  "/owner/paket": (
    <>
      <path d="M12 21v-8" />
      <path d="M12 13c0-3.3-2.2-5.5-5.5-5.5 0 3.3 2.2 5.5 5.5 5.5Z" />
      <path d="M12 11c0-3.3 2.2-5.5 5.5-5.5 0 3.3-2.2 5.5-5.5 5.5Z" />
      <path d="M8 21h8" />
    </>
  ),
  "/owner/pengaturan": (
    <>
      <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="8" cy="17" r="2" />
    </>
  ),
};

function iconKey(href: string): string {
  if (href.startsWith("/owner/fitur/")) return href.slice("/owner/fitur/".length);
  if (href === "/owner/kasbon") return "kasbon";
  return href;
}

export function MenuIcon({ href }: { href: string }) {
  const icon = ICONS[iconKey(href)];
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0">
      {icon ?? <circle cx="12" cy="12" r="3" />}
    </svg>
  );
}
