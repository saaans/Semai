import Link from "next/link";
import { TOTAL_STEPS } from "@/lib/onboarding/defaults";

/** Progress bar + judul langkah + tombol kembali. */
export function StepHeader({
  step,
  title,
  description,
}: {
  step: number;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-4 text-sm">
        {step > 1 ? (
          <Link
            href={`/owner/onboarding/${step - 1}`}
            className="-ml-2 inline-flex min-h-11 items-center gap-1.5 rounded-button px-2 text-graphite hover:bg-taupe"
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
              aria-hidden
            >
              <path d="M19 12H5M11 18l-6-6 6-6" />
            </svg>
            Kembali
          </Link>
        ) : (
          <span />
        )}
        <span className="text-smoke">
          Langkah <span className="font-mono text-ink">{step}</span> dari{" "}
          <span className="font-mono">{TOTAL_STEPS}</span>
        </span>
      </div>
      <div
        role="progressbar"
        aria-label="Progress onboarding"
        aria-valuemin={0}
        aria-valuemax={TOTAL_STEPS}
        aria-valuenow={step}
        className="flex gap-1.5"
      >
        {Array.from({ length: TOTAL_STEPS }, (_, i) => (
          <span
            key={i}
            className={i < step ? "h-1.5 flex-1 rounded-full bg-ink" : "h-1.5 flex-1 rounded-full bg-stone"}
          />
        ))}
      </div>
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl sm:text-4xl">{title}</h1>
        <p className="text-smoke">{description}</p>
      </div>
    </div>
  );
}
