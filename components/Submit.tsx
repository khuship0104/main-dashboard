"use client";

import { useFormStatus } from "react-dom";

/** Submit button that disables itself while the server action runs. */
export default function Submit({
  children,
  className,
  label,
}: {
  children: React.ReactNode;
  className?: string;
  label?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending} aria-label={label} aria-busy={pending}>
      {children}
    </button>
  );
}
