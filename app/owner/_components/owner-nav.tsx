"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { CompanyLogo } from "@/components/company-logo";
import { PlanBadge, type PlanBadgeKind } from "@/components/ui/plan-badge";
import { cn } from "@/lib/cn";
import type { MenuItem } from "./menu";
import { MenuIcon } from "./menu-icon";

export type OwnerAccount = {
  name: string;
  email: string | null;
  plan: { kind: PlanBadgeKind; label: string };
};

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
          {index === 1 && <li className="px-3 pb-1 text-xs text-ash">Fitur</li>}
          {items.map((item) => {
            const active = isActive(pathname, item.href);
            const content = (
              <>
                <MenuIcon href={item.href} />
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
              "flex min-h-10 items-center gap-3 rounded-button px-3 text-sm transition-colors",
              active
                ? "bg-taupe font-medium text-ink shadow-[inset_0_0_0_1px_var(--stone)]"
                : "text-graphite hover:bg-taupe/70 hover:text-ink",
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
  account,
  logout,
}: {
  groups: MenuItem[][];
  companyName: string;
  logoUrl: string | null;
  account: OwnerAccount;
  /** Form keluar (server action). */
  logout: React.ReactNode;
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
            <div className="mt-auto">
              <AccountMenu account={account} logout={logout} />
            </div>
          </nav>
        </div>
      )}

      {/* Laptop */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-stone lg:flex">
        <div className="px-5 pt-6 pb-5">{brand}</div>
        <nav aria-label="Menu owner" className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
          <MenuLinks groups={groups} pathname={pathname} />
        </nav>
        <div className="border-t border-stone p-3">
          <AccountMenu account={account} logout={logout} />
        </div>
      </aside>
    </>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts.at(0)?.charAt(0) ?? "?";
  const last = parts.length > 1 ? (parts.at(-1)?.charAt(0) ?? "") : "";
  return (first + last).toUpperCase();
}

/**
 * Akun di kiri bawah (mirip ChatGPT): foto inisial, nama, badge paket. Klik
 * membuka menu kecil ke atas berisi email, Paket, Pengaturan, dan Keluar.
 */
function AccountMenu({ account, logout }: { account: OwnerAccount; logout: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const onClick = (event: MouseEvent) => {
      if (!(event.target as Element).closest?.("[data-account-menu]")) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("click", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("click", onClick);
    };
  }, [open]);

  return (
    <div className="relative" data-account-menu>
      {open && (
        <div
          id="account-menu"
          className="absolute inset-x-0 bottom-full mb-2 flex flex-col gap-0.5 rounded-card border border-stone bg-canvas p-2 shadow-[0_12px_32px_-12px_rgb(0_0_0/0.25)]"
        >
          <p className="truncate px-3 pt-1 pb-2 text-xs text-smoke">{account.email ?? account.name}</p>
          <Link href="/owner/paket" className="flex min-h-10 items-center gap-3 rounded-button px-3 text-sm text-graphite hover:bg-taupe hover:text-ink">
            <MenuIcon href="/owner/paket" />
            {account.plan.kind === "gratis" ? "Upgrade paket" : "Paket & tagihan"}
          </Link>
          <Link href="/owner/pengaturan" className="flex min-h-10 items-center gap-3 rounded-button px-3 text-sm text-graphite hover:bg-taupe hover:text-ink">
            <MenuIcon href="/owner/pengaturan" />
            Pengaturan
          </Link>
          <div className="mt-1 border-t border-stone pt-1">{logout}</div>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="account-menu"
        className="flex w-full items-center gap-3 rounded-button p-2 text-left transition-colors hover:bg-taupe focus-visible:outline-2 focus-visible:outline-ink"
      >
        <span
          aria-hidden
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-medium",
            account.plan.kind === "premium"
              ? "bg-linear-to-br from-gold-soft to-gold text-on-gold"
              : "bg-ink text-canvas",
          )}
        >
          {initials(account.name)}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-sm font-medium text-ink">{account.name}</span>
          <PlanBadge kind={account.plan.kind} className="self-start">
            {account.plan.label}
          </PlanBadge>
        </span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0 text-ash">
          <path d="m8 10 4-4 4 4M8 14l4 4 4-4" />
        </svg>
      </button>
    </div>
  );
}
