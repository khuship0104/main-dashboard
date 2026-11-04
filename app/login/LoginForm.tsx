"use client";

import { useFormState } from "react-dom";
import { signIn } from "../actions";
import Submit from "@/components/Submit";

export default function LoginForm({ next }: { next: string }) {
  const [state, action] = useFormState(signIn, undefined);
  return (
    <form action={action} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <input type="hidden" name="next" value={next} />
      <label className="field" htmlFor="password">
        Password
        <input id="password" name="password" type="password" autoComplete="current-password" required autoFocus />
      </label>
      {state?.error ? <p className="error" role="alert">{state.error}</p> : null}
      <Submit className="primary">Sign in</Submit>
    </form>
  );
}
