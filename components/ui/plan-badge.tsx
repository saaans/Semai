import { cn } from "@/lib/cn";

export type PlanBadgeKind = "gratis" | "premium" | "trial";

const styles: Record<PlanBadgeKind, string> = {
  gratis: "border border-stone text-graphite",
  premium:
    "bg-linear-to-br from-gold-soft via-gold to-gold-soft text-on-gold shadow-[inset_0_0_0_1px_rgb(0_0_0/0.08)]",
  trial: "border border-gold text-graphite",
};

/** Badge paket: Gratis (Benih), Premium (berbayar, emas), atau Trial. */
export function PlanBadge({ kind, children, className }: { kind: PlanBadgeKind; children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 shrink-0 items-center gap-1 rounded-full px-2 text-[11px] font-medium whitespace-nowrap",
        styles[kind],
        className,
      )}
    >
      {kind === "premium" && (
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinejoin="round" aria-hidden>
          <path d="M12 2l2.6 6.9L22 9.5l-5.6 4.8L18.2 22 12 18l-6.2 4 1.8-7.7L2 9.5l7.4-.6L12 2Z" />
        </svg>
      )}
      {children}
    </span>
  );
}
