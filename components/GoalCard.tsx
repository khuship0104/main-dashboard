import { daysBetween, fmtShort } from "@/lib/dates";
import type { GoalWithProgress } from "@/lib/goals";
import { Bar, StatusTag } from "./ui";

export default function GoalCard({ item, today, extra }: { item: GoalWithProgress; today: string; extra?: React.ReactNode }) {
  const { goal, progress } = item;
  const total = Math.max(1, daysBetween(goal.start_date, goal.due_date));
  const expected = goal.metric === "job" ? undefined : Math.min(100, Math.max(0, (daysBetween(goal.start_date, today) / total) * 100));
  return (
    <div className="goal">
      <div className="goal-top">
        <div className="row" style={{ gap: 8 }}>
          <h3>{goal.title}</h3>
          <span className={`tag ${goal.category}`}>{goal.category}</span>
        </div>
        <StatusTag status={progress.status} />
      </div>
      <Bar pct={progress.pct} expected={progress.status === "done" ? undefined : expected} good={progress.status === "done"} />
      <div className="row spread small">
        <span className="num">{progress.current}</span>
        <span className="muted">
          Due {fmtShort(goal.due_date)} · <span className="num">{progress.daysLeft}</span> days left
        </span>
      </div>
      <p className="small muted">{progress.detail}</p>
      {extra}
    </div>
  );
}
