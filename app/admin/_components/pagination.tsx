import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";

/** Navigasi halaman sederhana. hrefFor(page) membuat tautan per halaman. */
export function Pagination({
  page,
  total,
  pageSize,
  hrefFor,
}: {
  page: number;
  total: number;
  pageSize: number;
  hrefFor: (page: number) => string;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <nav aria-label="Halaman" className="flex items-center justify-between gap-3">
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} className={buttonClasses({ variant: "secondary" })}>
          Sebelumnya
        </Link>
      ) : (
        <span />
      )}
      <span className="text-sm text-smoke">
        Halaman {page} dari {pages}
      </span>
      {page < pages ? (
        <Link href={hrefFor(page + 1)} className={buttonClasses({ variant: "secondary" })}>
          Berikutnya
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
