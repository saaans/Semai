import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

type Tone = "neutral" | "accent" | "ink" | "outline";

const tones: Record<Tone, string> = {
  neutral: "bg-stone text-graphite",
  accent: "bg-accent text-on-accent",
  ink: "bg-ink text-canvas",
  outline: "border border-stone text-smoke",
};

export type TagProps = ComponentProps<"span"> & { tone?: Tone };

/** Label status, selalu bulat penuh. */
export function Tag({ tone = "neutral", className, ...props }: TagProps) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1 rounded-full px-2.5 text-xs font-medium whitespace-nowrap",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
