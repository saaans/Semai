import { masukGoogle } from "../actions";
import { SubmitButton } from "./submit-button";

function GoogleIcon() {
  return (
    <svg
      aria-hidden
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20.5 12a8.5 8.5 0 1 1-2.5-6" />
      <path d="M20.5 12H12.5" />
    </svg>
  );
}

/** Tombol "… dengan Google". Server Action langsung redirect ke Google. */
export function GoogleButton({ label, next }: { label: string; next?: string | null }) {
  return (
    <form action={masukGoogle}>
      {next && <input type="hidden" name="next" value={next} />}
      <SubmitButton variant="secondary" arrow={false} pendingText="Membuka Google…">
        <span className="flex items-center gap-2">
          <GoogleIcon />
          {label}
        </span>
      </SubmitButton>
    </form>
  );
}
