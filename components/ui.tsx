import type { Status } from "@/lib/stats";

const STATUS_LABEL: Record<Status, string> = {
  done: "Done",
  ahead: "Ahead",
  "on-track": "On track",
  behind: "Behind",
  "not-started": "Not started",
};

export function StatusTag({ status }: { status: Status }) {
  return <span className={`tag ${status}`}>{STATUS_LABEL[status]}</span>;
}

/** Progress bar with an optional marker for where you'd be on a straight-line pace. */
export function Bar({ pct, expected, good }: { pct: number; expected?: number; good?: boolean }) {
  const p = Math.max(0, Math.min(100, pct));
  return (
    <div className="bar" role="progressbar" aria-valuenow={Math.round(p)} aria-valuemin={0} aria-valuemax={100}>
      <i className={good ? "good" : undefined} style={{ width: `${p}%` }} />
      {expected !== undefined && expected > 0 && expected < 100 ? <b style={{ left: `${expected}%` }} title="Straight-line pace" /> : null}
    </div>
  );
}

export function Tile({ value, label, sub }: { value: React.ReactNode; label: string; sub?: React.ReactNode }) {
  return (
    <div className="tile">
      <span className="label">{label}</span>
      <span className="big num">{value}</span>
      {sub ? <span className="small muted">{sub}</span> : null}
    </div>
  );
}

/** Hidden input carrying the day being edited, so actions write to the right date. */
export function DayInput({ day }: { day: string }) {
  return <input type="hidden" name="day" value={day} />;
}
