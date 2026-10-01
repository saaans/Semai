import { Skeleton } from "@/components/ui/skeleton";

/** Kerangka layar karyawan selama data dimuat. */
export default function EmployeeLoading() {
  return (
    <div role="status" aria-label="Memuat halaman" className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 px-5 py-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-20" />
        <Skeleton className="h-9 w-24" />
      </div>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-4 w-40" />
      </div>
      <div className="flex flex-col gap-4 rounded-card bg-taupe p-5">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-12 w-36" />
        <Skeleton className="h-11 w-full" />
      </div>
      <div className="flex flex-col gap-3 rounded-card bg-taupe p-5">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center justify-between">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-14" />
          </div>
        ))}
      </div>
      <span className="sr-only">Memuat…</span>
    </div>
  );
}
