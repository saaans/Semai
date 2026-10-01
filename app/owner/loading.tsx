import { Skeleton } from "@/components/ui/skeleton";

/** Kerangka halaman owner selama data dimuat. Menu samping tetap tampil. */
export default function OwnerLoading() {
  return (
    <div role="status" aria-label="Memuat halaman" className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-4 w-56" />
      </div>
      <div className="flex flex-col gap-4 rounded-card bg-taupe p-5 sm:p-6">
        <Skeleton className="h-10 w-3/4 max-w-sm" />
        <Skeleton className="h-3 w-full rounded-full" />
        <div className="flex flex-wrap gap-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-4 w-24" />
          ))}
        </div>
      </div>
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-44" />
        <Skeleton className="h-4 w-24" />
      </div>
      <div className="flex flex-col divide-y divide-stone rounded-card bg-taupe">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center justify-between gap-4 px-4 py-5 sm:px-6">
            <div className="flex flex-col gap-2">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
        ))}
      </div>
      <span className="sr-only">Memuat…</span>
    </div>
  );
}
