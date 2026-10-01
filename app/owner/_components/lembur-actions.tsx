"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { FormAlert } from "@/app/(auth)/_components/form-alert";
import { buttonClasses } from "@/components/ui/button";
import { putuskanLembur, type LemburState } from "../absen/actions";

function DecisionButton({ decision }: { decision: "setujui" | "tolak" }) {
  const { pending, data } = useFormStatus();
  const mine = pending && data?.get("decision") === decision;
  return (
    <button
      type="submit"
      name="decision"
      value={decision}
      disabled={pending}
      aria-busy={mine}
      className={buttonClasses({
        variant: decision === "setujui" ? "primary" : "secondary",
        arrow: false,
        className: "min-w-24",
      })}
    >
      {mine ? "Menyimpan…" : decision === "setujui" ? "Setujui" : "Tolak"}
    </button>
  );
}

/** Tombol setujui / tolak lembur. Keputusan tercatat di audit log. */
export function LemburActions({ attendanceId }: { attendanceId: string }) {
  const [state, action] = useActionState<LemburState, FormData>(putuskanLembur, {});

  if (state.decided) {
    return <p className="text-sm text-smoke">Lembur {state.decided}.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      <form action={action} className="flex gap-2">
        <input type="hidden" name="attendanceId" value={attendanceId} />
        <DecisionButton decision="setujui" />
        <DecisionButton decision="tolak" />
      </form>
      {state.message && <FormAlert tone="error">{state.message}</FormAlert>}
    </div>
  );
}
