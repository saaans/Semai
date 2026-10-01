"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { CompanyLogo } from "@/components/company-logo";
import { cn } from "@/lib/cn";
import type { MenuItem } from "./menu";

function LockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

function isActive(pathname: string, href: string) {
  return href === "/owner" ? pathname === "/owner" : pathname === href || pathname.startsWith(`${href}/`);
}

function MenuLinks({ groups, pathname }: { groups: MenuItem[][]; pathname: string }) {
  return (
    <div className="flex flex-col gap-4">
      {groups.map((items, index) => (
        <ul key={index} className="flex flex-col gap-0.5 border-t border-stone pt-4 first:border-t-0 first:pt-0">
          {items.map((item) => {
            const active = isActive(pathname, item.href);
            const content = (
              <>
                <span className="flex-1 truncate">{item.label}</span>
                {item.state === "terkunci" && (
                  <span className="flex shrink-0 items-center gap-1 text-xs text-ash">
                    <LockIcon />
                    {item.planLabel}
                  </span>
                )}
                {item.state === "segera" && <span className="shrink-0 text-xs text-ash">Segera</span>}
              </>
            );
            const className = cn(
              "flex min-h-11 items-center gap-2 rounded-button px-3 text-sm",
              active ? "bg-taupe font-medium text-ink" : "text-graphite hover:bg-taupe hover:text-ink",
            );

            // Halaman yang belum dibuat (bukan fitur paket) tidak bisa diklik.
            if (item.state === "segera" && !item.href.startsWith("/owner/fitur/")) {
              return (
                <li key={item.href}>
                  <span className={cn(className, "cursor-default text-ash hover:bg-transparent hover:text-ash")} aria-disabled>
                    {content}
                  </span>
                </li>
              );
            }
            return (
              <li key={item.href}>
                <Link href={item.href} className={className} aria-current={active ? "page" : undefined}>
                  {content}
                </Link>
              </li>
            );
          })}
        </ul>
      ))}
    </div>
  );
}

/**
 * Menu samping owner. Laptop: sidebar tetap. HP: tombol "Menu" membuka
 * laci dari kiri, tertutup otomatis saat pindah halaman.
 */
export function OwnerNav({
  groups,
  companyName,
  logoUrl,
  footer,
}: {
  groups: MenuItem[][];
  companyName: string;
  logoUrl: string | null;
  footer: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [lastPath, setLastPath] = useState(pathname);

  // Tutup laci setelah pindah halaman.
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  const brand = (
    <Link href="/owner" className="flex min-w-0 items-center gap-3">
      <CompanyLogo url={logoUrl} name={companyName} />
      <span className="flex min-w-0 flex-col">
        <span className="truncate font-medium text-ink">{companyName}</span>
        <span className="font-display text-sm tracking-tight text-smoke">semai</span>
      </span>
    </Link>
  );

  return (
    <>
      {/* HP */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-stone bg-canvas px-5 py-3 lg:hidden">
        {brand}
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={open}
          aria-controls="owner-menu"
          className="flex min-h-11 items-center gap-2 rounded-button border border-stone px-3 text-sm text-ink"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden>
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
          Menu
        </button>
      </header>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button type="button" aria-label="Tutup menu" className="absolute inset-0 bg-ink/30" onClick={() => setOpen(false)} />
          <nav
            id="owner-menu"
            aria-label="Menu owner"
            className="absolute inset-y-0 left-0 flex w-[min(20rem,85vw)] flex-col gap-6 overflow-y-auto bg-canvas px-4 py-4"
          >
            <div className="flex items-start justify-between gap-2 px-1">
              {brand}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="min-h-11 rounded-button px-2 text-sm text-graphite hover:bg-taupe"
              >
                Tutup
              </button>
            </div>
            <MenuLinks groups={groups} pathname={pathname} />
            <div className="mt-auto border-t border-stone pt-4">{footer}</div>
          </nav>
        </div>
      )}

      {/* Laptop */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-6 overflow-y-auto border-r border-stone px-4 py-6 lg:flex">
        <div className="px-1">{brand}</div>
        <nav aria-label="Menu owner">
          <MenuLinks groups={groups} pathname={pathname} />
        </nav>
        <div className="mt-auto border-t border-stone pt-4">{footer}</div>
      </aside>
    </>
  );
}
