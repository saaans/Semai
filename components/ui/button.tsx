import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary";

type StyleProps = {
  variant?: Variant;
  /** Tampilkan chip panah hitam di kanan. Default: aktif untuk primary. */
  arrow?: boolean;
  fullWidth?: boolean;
};

const base =
  "group inline-flex min-h-11 items-center justify-center gap-3 rounded-button px-4 text-sm font-medium transition-[background,border-color,opacity,transform] duration-150 select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink active:translate-y-px disabled:pointer-events-none disabled:opacity-50";

const variants: Record<Variant, string> = {
  primary:
    "bg-linear-to-b from-accent-soft to-accent text-on-accent hover:from-accent hover:to-accent",
  secondary:
    "border border-stone bg-transparent text-ink hover:border-graphite hover:bg-taupe",
};

export function buttonClasses({
  variant = "primary",
  arrow,
  fullWidth,
  className,
}: StyleProps & { className?: string }) {
  const showArrow = arrow ?? variant === "primary";
  return cn(
    base,
    variants[variant],
    showArrow && "pr-1.5",
    fullWidth && "w-full",
    className,
  );
}

function ArrowChip() {
  return (
    <span
      aria-hidden
      className="flex size-8 shrink-0 items-center justify-center rounded-[7px] bg-on-accent text-accent transition-transform duration-150 group-hover:translate-x-0.5"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M5 12h14M13 6l6 6-6 6" />
      </svg>
    </span>
  );
}

export type ButtonProps = ComponentProps<"button"> & StyleProps;

export function Button({
  variant = "primary",
  arrow,
  fullWidth,
  className,
  children,
  type = "button",
  ...props
}: ButtonProps) {
  const showArrow = arrow ?? variant === "primary";
  return (
    <button
      type={type}
      className={buttonClasses({ variant, arrow, fullWidth, className })}
      {...props}
    >
      <span className={cn(showArrow && "flex-1 pl-0.5 text-left")}>
        {children}
      </span>
      {showArrow && <ArrowChip />}
    </button>
  );
}

export type ButtonLinkProps = ComponentProps<typeof Link> & StyleProps;

/** Tautan yang tampil sebagai tombol. */
export function ButtonLink({
  variant = "primary",
  arrow,
  fullWidth,
  className,
  children,
  ...props
}: ButtonLinkProps) {
  const showArrow = arrow ?? variant === "primary";
  return (
    <Link
      className={buttonClasses({ variant, arrow, fullWidth, className })}
      {...props}
    >
      <span className={cn(showArrow && "flex-1 pl-0.5 text-left")}>
        {children}
      </span>
      {showArrow && <ArrowChip />}
    </Link>
  );
}
