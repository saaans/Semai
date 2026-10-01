import Link from "next/link";
import { LogoutForm } from "./logout-form";

const linkClass =
  "flex min-h-11 items-center rounded-button px-2 text-sm text-graphite underline-offset-4 hover:text-ink hover:underline";

/** Menu atas area karyawan: riwayat dan keluar. */
export function EmployeeNav({ companyId }: { companyId?: string }) {
  return (
    <nav className="flex items-center gap-1">
      {companyId && (
        <Link href={`/app/riwayat?usaha=${companyId}`} className={linkClass}>
          Riwayat
        </Link>
      )}
      <LogoutForm className={linkClass} />
    </nav>
  );
}
