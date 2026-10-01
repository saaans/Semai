"use client";

import Link from "next/link";
import { useActionState } from "react";
import { FormAlert } from "@/app/(auth)/_components/form-alert";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Tag } from "@/components/ui/tag";
import { cn } from "@/lib/cn";
import { ubahRemote, type RemoteState } from "../actions";

function LockIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

/**
 * Sakelar kerja remote di detail karyawan. Fitur paket berbayar: di Benih
 * tetap terlihat dengan gembok dan menuju halaman fitur terkunci. Mematikan
 * remote selalu bisa.
 */
export function RemoteToggle({
  employeeId,
  isRemote,
  unlocked,
  planLabel,
  graceNote,
}: {
  employeeId: string;
  isRemote: boolean;
  /** Paket usaha punya fitur absen_remote. */
  unlocked: boolean;
  planLabel: string;
  /** Peringatan masa tenggang / remote tidak berlaku lagi. */
  graceNote: string | null;
}) {
  const [state, action, pending] = useActionState<RemoteState, FormData>(ubahRemote, {});
  const canToggle = unlocked || isRemote;

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle>Kerja remote</CardTitle>
            <Tag tone={unlocked ? "outline" : "neutral"}>
              {!unlocked && <LockIcon />}
              Premium · {planLabel}
            </Tag>
          </div>
          <CardDescription>
            Absen bisa dari mana saja, tanpa batas radius. Selfie dan lokasi tetap tercatat.
          </CardDescription>
        </div>
        {canToggle ? (
          <form action={action}>
            <input type="hidden" name="employeeId" value={employeeId} />
            <input type="hidden" name="remote" value={isRemote ? "tidak" : "ya"} />
            <button
              type="submit"
              role="switch"
              aria-checked={isRemote}
              aria-label="Kerja remote"
              disabled={pending}
              className={cn(
                "relative mt-1 inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors disabled:opacity-50",
                isRemote ? "border-ink bg-ink" : "border-stone bg-canvas",
              )}
            >
              <span
                className={cn(
                  "inline-block size-5 rounded-full transition-transform",
                  isRemote ? "translate-x-6 bg-accent" : "translate-x-1 bg-ash",
                )}
              />
            </button>
          </form>
        ) : (
          <Link
            href="/owner/fitur/absen_remote"
            className="mt-1 inline-flex min-h-11 shrink-0 items-center gap-1 rounded-button px-2 text-sm text-graphite underline underline-offset-4 hover:text-ink"
          >
            <LockIcon />
            Lihat
          </Link>
        )}
      </div>
      {graceNote && <p className="text-sm text-danger">{graceNote}</p>}
      {state.message && <FormAlert tone="error">{state.message}</FormAlert>}
    </Card>
  );
}
