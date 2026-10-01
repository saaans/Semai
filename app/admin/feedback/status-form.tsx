"use client";

import { useActionState } from "react";
import { FEEDBACK_PRIORITIES, FEEDBACK_STATUSES } from "@/lib/feedback/schemas";
import { ubahStatusMasukan, type FeedbackStatusState } from "./actions";

const selectClass =
  "min-h-11 rounded-button border border-stone bg-canvas px-2.5 text-sm text-ink hover:border-ash focus:border-ink focus:outline-none disabled:opacity-50";

/** Status dan prioritas satu masukan. Tersimpan otomatis begitu diganti. */
export function StatusForm({ id, status, priority }: { id: string; status: string; priority: string | null }) {
  const [state, action, pending] = useActionState<FeedbackStatusState, FormData>(ubahStatusMasukan, {});

  return (
    <form
      action={action}
      onChange={(event) => event.currentTarget.requestSubmit()}
      className="flex flex-wrap items-center gap-2"
    >
      <input type="hidden" name="id" value={id} />
      <label className="sr-only" htmlFor={`status-${id}`}>
        Status
      </label>
      <select id={`status-${id}`} name="status" defaultValue={status} disabled={pending} className={selectClass}>
        {FEEDBACK_STATUSES.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <label className="sr-only" htmlFor={`priority-${id}`}>
        Prioritas
      </label>
      <select id={`priority-${id}`} name="priority" defaultValue={priority ?? ""} disabled={pending} className={selectClass}>
        {FEEDBACK_PRIORITIES.map((o) => (
          <option key={o.value} value={o.value}>
            {o.value === "" ? "Prioritas: belum diset" : `Prioritas: ${o.label.toLowerCase()}`}
          </option>
        ))}
      </select>
      <span role="status" className="text-xs text-smoke">
        {pending ? "Menyimpan…" : state.message ? <span className="text-danger">{state.message}</span> : state.saved ? "Tersimpan" : null}
      </span>
    </form>
  );
}
