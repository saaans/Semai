import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

/** Balok abu-abu berdenyut sebagai pengganti isi yang sedang dimuat. */
export function Skeleton({ className, ...props }: ComponentProps<"div">) {
  return <div aria-hidden className={cn("rounded-button bg-stone motion-safe:animate-pulse", className)} {...props} />;
}
