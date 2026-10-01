"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

const LINKS = [
  { href: "/admin", label: "Ringkasan" },
  { href: "/admin/usaha", label: "Usaha" },
  { href: "/admin/tagihan", label: "Tagihan" },
  { href: "/admin/foto", label: "Hapus foto" },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Menu super admin" className="-mx-1 flex gap-1 overflow-x-auto">
      {LINKS.map((link) => {
        const active = link.href === "/admin" ? pathname === "/admin" : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-11 items-center rounded-button px-3 text-sm whitespace-nowrap transition-colors",
              active ? "bg-taupe font-medium text-ink" : "text-smoke hover:text-ink",
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
