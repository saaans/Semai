import { useId } from "react";
import { cn } from "@/lib/cn";

type Option = { value: string; label: string; hint?: string };

/** Pilihan radio berbentuk kartu kecil: satu ketukan, nyaman di HP. */
export function ChoiceGroup({
  label,
  name,
  options,
  defaultValue,
  value,
  onChange,
  error,
  columns = 2,
}: {
  label: string;
  name: string;
  options: readonly Option[];
  defaultValue?: string | null;
  value?: string;
  onChange?: (value: string) => void;
  error?: string;
  columns?: 2 | 3;
}) {
  const errorId = useId();
  return (
    <fieldset
      className="flex flex-col gap-1.5"
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? errorId : undefined}
    >
      <legend className="mb-1.5 text-sm font-medium text-graphite">{label}</legend>
      <div className={cn("grid gap-2", columns === 3 ? "grid-cols-3" : "grid-cols-2")}>
        {options.map((option) => (
          <label
            key={option.value}
            className={cn(
              "group relative flex min-h-11 cursor-pointer flex-col justify-center rounded-button border border-stone bg-canvas py-2.5 pr-9 pl-3.5 text-sm text-ink transition-colors hover:border-ash",
              "has-checked:border-graphite has-checked:bg-taupe",
              "has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ink",
              error && "border-danger",
            )}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              className="sr-only"
              {...(value !== undefined
                ? { checked: value === option.value, onChange: () => onChange?.(option.value) }
                : { defaultChecked: defaultValue === option.value })}
            />
            <span className="font-medium">{option.label}</span>
            {option.hint && <span className="text-xs text-smoke">{option.hint}</span>}
            {/* Penanda radio: lingkaran kosong, terisi saat dipilih. */}
            <span
              aria-hidden
              className="absolute top-1/2 right-3 size-4 -translate-y-1/2 rounded-full border border-ash transition-[border-width,border-color] group-has-checked:border-[5px] group-has-checked:border-ink"
            />
          </label>
        ))}
      </div>
      {error && (
        <p id={errorId} className="text-sm text-danger">
          {error}
        </p>
      )}
    </fieldset>
  );
}
