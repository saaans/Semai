"use client";

import { useId } from "react";
import { cn } from "@/lib/cn";

/** Kolom alasan: wajib untuk perubahan gaji, tercatat di riwayat perubahan. */
export function ReasonField({
  error,
  label = "Alasan",
  placeholder,
  hint = "Tercatat di riwayat perubahan.",
  required = true,
}: {
  error?: string;
  label?: string;
  placeholder: string;
  hint?: string;
  required?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-graphite">
        {label}
      </label>
      <textarea
        id={id}
        name="reason"
        required={required}
        minLength={required ? 5 : undefined}
        maxLength={300}
        rows={2}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        className={cn(
          "w-full rounded-button border border-stone bg-canvas px-3.5 py-2.5 text-base text-ink placeholder:text-ash hover:border-ash focus:border-ink focus:outline-none",
          error && "border-danger",
        )}
      />
      {error ? <p className="text-sm text-danger">{error}</p> : <p className="text-sm text-ash">{hint}</p>}
    </div>
  );
}

/** Pilihan dropdown dengan label, gaya sama dengan Input. */
export function SelectField({
  label,
  name,
  options,
  defaultValue,
  value,
  onChange,
  error,
  hint,
}: {
  label: string;
  name: string;
  options: { value: string; label: string }[];
  defaultValue?: string;
  value?: string;
  onChange?: (value: string) => void;
  error?: string;
  hint?: string;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-graphite">
        {label}
      </label>
      <select
        id={id}
        name={name}
        defaultValue={value === undefined ? defaultValue : undefined}
        value={value}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        aria-invalid={error ? true : undefined}
        className={cn(
          "min-h-11 w-full rounded-button border border-stone bg-canvas px-3 text-base text-ink hover:border-ash focus:border-ink focus:outline-none",
          error && "border-danger",
        )}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {error ? <p className="text-sm text-danger">{error}</p> : hint ? <p className="text-sm text-ash">{hint}</p> : null}
    </div>
  );
}
