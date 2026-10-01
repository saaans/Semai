import { cn } from "@/lib/cn";

/** Logo usaha persegi, atau huruf awal nama kalau belum ada logo. */
export function CompanyLogo({
  url,
  name,
  className,
}: {
  url: string | null;
  name: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-button border border-stone bg-taupe",
        className,
      )}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- bucket publik Supabase
        <img src={url} alt={`Logo ${name}`} className="size-full object-cover" />
      ) : (
        <span aria-hidden className="font-display text-lg text-smoke">
          {name.trim().slice(0, 1).toUpperCase() || "?"}
        </span>
      )}
    </span>
  );
}
