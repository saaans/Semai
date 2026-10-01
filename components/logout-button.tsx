import { keluar } from "@/app/(auth)/actions";
import { cn } from "@/lib/cn";

/** Tombol keluar: tautan kecil di header, atau baris di menu akun. */
export function LogoutButton({ variant = "link" }: { variant?: "link" | "menu" }) {
  return (
    <form action={keluar}>
      <button
        type="submit"
        className={cn(
          "min-h-11 rounded-button text-sm text-graphite",
          variant === "link"
            ? "px-2 underline-offset-4 hover:text-ink hover:underline"
            : "flex min-h-10 w-full items-center gap-3 px-3 text-left hover:bg-taupe hover:text-ink",
        )}
      >
        {variant === "menu" && (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M14 4h3.5A2.5 2.5 0 0 1 20 6.5v11a2.5 2.5 0 0 1-2.5 2.5H14M10 16l-4-4 4-4M6 12h10" />
          </svg>
        )}
        Keluar
      </button>
    </form>
  );
}
