/** Dropdown filter untuk form GET (tanpa JavaScript). */
export function FilterSelect({
  label,
  name,
  value,
  options,
}: {
  label: string;
  name: string;
  value: string | null;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium text-graphite">
      {label}
      <select
        name={name}
        defaultValue={value ?? ""}
        className="min-h-11 w-full rounded-button border border-stone bg-canvas px-3 text-base font-normal text-ink hover:border-ash focus:border-ink focus:outline-none"
      >
        <option value="">Semua</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
