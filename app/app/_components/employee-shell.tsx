/** Kerangka mobile-first untuk halaman karyawan. */
export function EmployeeShell({
  header,
  children,
}: {
  header?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 px-5 py-6">
      <header className="flex min-h-11 items-center justify-between gap-3">
        <span className="font-display text-2xl tracking-tight">semai</span>
        {header}
      </header>
      <main className="flex flex-1 flex-col gap-6">{children}</main>
    </div>
  );
}
