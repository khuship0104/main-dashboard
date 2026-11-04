"use client";

import { useFormState } from "react-dom";
import { weightLog } from "@/app/actions";
import Submit from "./Submit";

export default function WeightForm({ day, current }: { day: string; current: number | null }) {
  const [state, action] = useFormState(weightLog, undefined);
  return (
    <form action={action} className="row" style={{ gap: 8 }}>
      <input type="hidden" name="day" value={day} />
      <label className="sr-only" htmlFor="weight" style={{ position: "absolute", left: -9999 }}>Weight in pounds</label>
      <input
        id="weight"
        name="weight"
        type="number"
        inputMode="decimal"
        step="0.1"
        min="50"
        max="800"
        placeholder="lb"
        defaultValue={current ?? undefined}
        key={current ?? "empty"}
      />
      <Submit className="primary">{current ? "Update" : "Log"}</Submit>
      {state?.error ? <span className="error small" role="alert">{state.error}</span> : null}
    </form>
  );
}
