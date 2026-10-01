"use client";

import { usePathname } from "next/navigation";
import { useActionState, useId } from "react";
import { FormAlert } from "@/app/(auth)/_components/form-alert";
import { SubmitButton } from "@/app/(auth)/_components/submit-button";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { FEEDBACK_CATEGORIES } from "@/lib/feedback/schemas";
import { kirimMasukan, type FeedbackState } from "../feedback-actions";
import { SelectField } from "../gaji/_components/fields";
import { Sheet } from "./sheet";

function FeedbackForm({ onDone }: { onDone: () => void }) {
  const pathname = usePathname();
  const messageId = useId();
  const [state, action] = useActionState<FeedbackState, FormData>(kirimMasukan, {});

  if (state.saved) {
    return (
      <div className="flex flex-col gap-4">
        <FormAlert tone="success">Masukan terkirim. Makasih, tim Semai akan membacanya.</FormAlert>
        <Button variant="secondary" arrow={false} fullWidth onClick={onDone}>
          Tutup
        </Button>
      </div>
    );
  }

  const error = state.errors?.message;
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="pagePath" value={pathname} />
      {state.message && <FormAlert tone="error">{state.message}</FormAlert>}
      <SelectField
        label="Kategori"
        name="category"
        options={FEEDBACK_CATEGORIES.map((c) => ({ value: c.value, label: c.label }))}
        error={state.errors?.category}
      />
      <div className="flex flex-col gap-1.5">
        <label htmlFor={messageId} className="text-sm font-medium text-graphite">
          Isi masukan
        </label>
        <textarea
          id={messageId}
          name="message"
          required
          minLength={5}
          maxLength={2000}
          rows={5}
          placeholder="Contoh: rekap absen bulanan susah dicari, tolong taruh di dashboard."
          aria-invalid={error ? true : undefined}
          className={cn(
            "w-full rounded-button border border-stone bg-canvas px-3.5 py-2.5 text-base text-ink placeholder:text-ash hover:border-ash focus:border-ink focus:outline-none",
            error && "border-danger",
          )}
        />
        {error ? (
          <p className="text-sm text-danger">{error}</p>
        ) : (
          <p className="text-sm text-ash">Dibaca langsung oleh tim Semai. Jangan tulis password atau PIN.</p>
        )}
      </div>
      <SubmitButton pendingText="Mengirim…">Kirim masukan</SubmitButton>
    </form>
  );
}

/** Tombol mengambang kanan bawah di area owner untuk kirim masukan ke tim Semai. */
export function FeedbackButton() {
  return (
    <div className="fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-30 print:hidden sm:right-6 sm:bottom-6">
      <Sheet
        title="Kasih masukan"
        subtitle="Saran, bug, atau pertanyaan soal Semai."
        triggerClassName="flex min-h-11 items-center gap-2 rounded-full bg-ink px-3.5 text-sm font-medium text-canvas shadow-[0_8px_24px_-8px_rgb(0_0_0/0.4)] hover:bg-graphite focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink sm:px-4"
        label={
          <>
            <svg
              aria-hidden
              viewBox="0 0 24 24"
              className="size-5"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.6}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 5.5h16v11H9l-5 4v-15Z" />
              <path d="M8.5 9.5h7M8.5 12.5h4.5" />
            </svg>
            <span className="sr-only sm:not-sr-only">Kasih masukan</span>
          </>
        }
      >
        {(done) => <FeedbackForm onDone={done} />}
      </Sheet>
    </div>
  );
}
