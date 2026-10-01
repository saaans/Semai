"use client";

import { useState } from "react";
import { FormAlert } from "@/app/(auth)/_components/form-alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  FIXED_SCHEDULE_NAME,
  MAX_SHIFTS,
  WEEK_DAYS,
  type ScheduleDefaults,
  type ScheduleDraft,
  type WorkMode,
} from "@/lib/onboarding/defaults";
import { simpanJamKerja } from "../actions";
import { ChoiceGroup } from "./choice-group";
import { useStepForm } from "./use-step-form";

const MODES = [
  { value: "tetap", label: "Jam tetap", hint: "Semua masuk di jam yang sama" },
  { value: "shift", label: "Shift", hint: "Ada jadwal pagi, sore, dst." },
] as const;

export function JamKerjaForm({ initial }: { initial: ScheduleDefaults }) {
  const { state, pending, onSubmit } = useStepForm(simpanJamKerja);
  const errors = state.errors ?? {};

  const [mode, setMode] = useState<WorkMode>(initial.mode);
  const [schedules, setSchedules] = useState<ScheduleDraft[]>(initial.schedules);
  const [workDays, setWorkDays] = useState<number[]>(initial.workDays);

  const visible = mode === "tetap" ? schedules.slice(0, 1) : schedules;

  function changeMode(next: string) {
    const value = next as WorkMode;
    setMode(value);
    if (value === "shift" && schedules[0]?.name === FIXED_SCHEDULE_NAME) {
      update(0, { name: "Shift 1" });
    }
  }

  function update(index: number, patch: Partial<ScheduleDraft>) {
    setSchedules((list) => list.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  function addShift() {
    setSchedules((list) => {
      const last = list[list.length - 1];
      return [...list, { name: `Shift ${list.length + 1}`, start: last?.end ?? "08:00", end: "17:00" }];
    });
  }

  function removeShift(index: number) {
    setSchedules((list) => list.filter((_, i) => i !== index));
  }

  function toggleDay(day: number) {
    setWorkDays((days) => (days.includes(day) ? days.filter((d) => d !== day) : [...days, day]));
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
      {state.message && <FormAlert tone="error">{state.message}</FormAlert>}

      <ChoiceGroup
        label="Cara kerja"
        name="mode"
        options={MODES}
        value={mode}
        onChange={changeMode}
        error={errors.mode}
      />

      <div className="flex flex-col gap-3">
        {visible.map((schedule, i) => (
          <div key={i} className="flex flex-col gap-3 rounded-button border border-stone bg-canvas p-3.5">
            {mode === "shift" ? (
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <Input
                    label={`Nama shift ${i + 1}`}
                    name="scheduleName"
                    value={schedule.name}
                    onChange={(e) => update(i, { name: e.target.value })}
                    maxLength={40}
                  />
                </div>
                {visible.length > 1 && (
                  <Button
                    variant="secondary"
                    arrow={false}
                    onClick={() => removeShift(i)}
                    aria-label={`Hapus ${schedule.name || `shift ${i + 1}`}`}
                  >
                    Hapus
                  </Button>
                )}
              </div>
            ) : (
              <input type="hidden" name="scheduleName" value={FIXED_SCHEDULE_NAME} />
            )}
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Jam masuk"
                name="scheduleStart"
                type="time"
                value={schedule.start}
                onChange={(e) => update(i, { start: e.target.value })}
                required
              />
              <Input
                label="Jam pulang"
                name="scheduleEnd"
                type="time"
                value={schedule.end}
                onChange={(e) => update(i, { end: e.target.value })}
                required
              />
            </div>
          </div>
        ))}
        {errors.schedules && <p className="text-sm text-danger">{errors.schedules}</p>}
        {mode === "shift" && schedules.length < MAX_SHIFTS && (
          <Button variant="secondary" arrow={false} onClick={addShift}>
            Tambah shift
          </Button>
        )}
        <p className="text-sm text-ash">
          Jam pulang lebih awal dari jam masuk berarti lewat tengah malam.
          {mode === "shift" && " Shift pertama dipakai sebagai jadwal utama."}
        </p>
      </div>

      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-sm font-medium text-graphite">Hari kerja</legend>
        <div className="grid grid-cols-7 gap-1.5">
          {WEEK_DAYS.map((day) => (
            <label
              key={day.value}
              className="flex min-h-11 cursor-pointer items-center justify-center rounded-button border border-stone bg-canvas text-sm text-ink transition-colors hover:border-ash has-checked:border-ink has-checked:bg-ink has-checked:text-canvas has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ink"
            >
              <input
                type="checkbox"
                name="workDays"
                value={day.value}
                checked={workDays.includes(day.value)}
                onChange={() => toggleDay(day.value)}
                className="sr-only"
              />
              {day.label}
            </label>
          ))}
        </div>
        {errors.workDays && <p className="text-sm text-danger">{errors.workDays}</p>}
      </fieldset>

      <Input
        label="Toleransi telat (menit)"
        name="lateToleranceMin"
        type="number"
        inputMode="numeric"
        min={0}
        max={240}
        defaultValue={initial.lateToleranceMin}
        hint="Absen masuk dalam batas ini belum dihitung telat."
        error={errors.lateToleranceMin}
        required
      />

      <Button type="submit" fullWidth disabled={pending} aria-busy={pending}>
        {pending ? "Menyimpan…" : "Lanjut"}
      </Button>
    </form>
  );
}
