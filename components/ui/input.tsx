import { useId, type ComponentProps } from "react";
import { cn } from "@/lib/cn";

export type InputProps = ComponentProps<"input"> & {
  label: string;
  /** Teks bantuan di bawah field. */
  hint?: string;
  /** Pesan error: jelaskan apa yang salah dan cara memperbaikinya. */
  error?: string;
};

export function Input({
  label,
  hint,
  error,
  id,
  className,
  ...props
}: InputProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const hintId = `${inputId}-hint`;
  const errorId = `${inputId}-error`;
  const describedBy =
    [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(" ") ||
    undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-sm font-medium text-graphite">
        {label}
      </label>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          "min-h-11 w-full rounded-button border border-stone bg-canvas px-3.5 text-base text-ink transition-colors placeholder:text-ash hover:border-ash focus:border-ink focus:outline-none disabled:opacity-50",
          error && "border-danger hover:border-danger focus:border-danger",
          className,
        )}
        {...props}
      />
      {error && (
        <p id={errorId} className="text-sm text-danger">
          {error}
        </p>
      )}
      {hint && (
        <p id={hintId} className="text-sm text-ash">
          {hint}
        </p>
      )}
    </div>
  );
}
