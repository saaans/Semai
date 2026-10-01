import { cn } from "@/lib/cn";

/** Pesan di atas form: error (tone danger) atau berhasil. */
export function FormAlert({
  tone,
  children,
  className,
}: {
  tone: "error" | "success";
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "rounded-button border px-3.5 py-3 text-sm",
        tone === "error" ? "border-danger text-danger" : "border-stone bg-canvas text-graphite",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function OrDivider() {
  return (
    <div className="flex items-center gap-3 text-xs text-ash" aria-hidden>
      <span className="h-px flex-1 bg-stone" />
      atau
      <span className="h-px flex-1 bg-stone" />
    </div>
  );
}
