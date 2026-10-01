import { keluar } from "@/app/(auth)/actions";

/** Tombol keluar kecil untuk header. */
export function LogoutButton() {
  return (
    <form action={keluar}>
      <button
        type="submit"
        className="min-h-11 rounded-button px-2 text-sm text-graphite underline-offset-4 hover:text-ink hover:underline"
      >
        Keluar
      </button>
    </form>
  );
}
