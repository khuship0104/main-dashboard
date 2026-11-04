import Link from "next/link";
import { getApplications, getAppliedDays, getChecks, getHabits, getLogs, getSettings, getWeighIns, getWorkouts } from "@/lib/data";
import { STAGE_LABEL } from "@/lib/constants";
import { addDays, daysBetween, fmtShort, parseQuarterParam, shiftQuarter, todayISO, weekStart } from "@/lib/dates";
import { goalsWithProgress, overlapping } from "@/lib/goals";
import { weeklySeries } from "@/lib/stats";
import GoalCard from "@/components/GoalCard";
import { BarChart, LineChart } from "@/components/Charts";
import { Tile } from "@/components/ui";

export default async function QuarterPage({ searchParams }: { searchParams: { q?: string } }) {
  const today = todayISO();
  const qt = parseQuarterParam(searchParams.q, today);
  const { start, end } = qt;
  const isCurrent = today >= start && today <= end;
  const span = [weekStart(start), addDays(weekStart(end), 6)] as const;

  const [settings, habits, checks, logs, weighIns, workouts, appliedDays, apps, goals] = await Promise.all([
    getSettings(), getHabits(), getChecks(span[0], span[1]), getLogs(span[0], span[1]), getWeighIns(),
    getWorkouts(span[0], span[1]), getAppliedDays(span[0], span[1]), getApplications(), goalsWithProgress(today),
  ]);

  const series = weeklySeries({ from: start, to: end, today, habits, checks, logs, workouts, appliedDays, weighIns, waterGoal: settings.waterGoal });
  const currentIdx = series.findIndex((p) => p.week > today);
  const futureFrom = currentIdx === -1 ? undefined : currentIdx;
  const label = (w: string) => fmtShort(w);

  const inQ = (d: string | null) => !!d && d >= start && d <= end;
  const qApps = apps.filter((a) => inQ(a.applied_on));
  const qWorkouts = workouts.filter((w) => inQ(w.day)).length;
  const pastWeeks = series.filter((p) => p.habitPct !== null);
  const avgHabit = pastWeeks.length ? Math.round(pastWeeks.reduce((s, p) => s + (p.habitPct ?? 0), 0) / pastWeeks.length) : 0;
  const qWeights = weighIns.filter((w) => inQ(w.day));
  const before = weighIns.filter((w) => w.day < start).at(-1);
  const wStart = before?.weight ?? qWeights[0]?.weight ?? null;
  const wEnd = qWeights.at(-1)?.weight ?? null;
  const weightGoal = goals.find((g) => g.goal.metric === "weight" && !g.goal.done)?.goal;
  const qGoals = overlapping(goals, start, end);
  const daysLeft = isCurrent ? daysBetween(today, end) : 0;
  const pastScreen = qApps.filter((a) => ["screen", "interview", "offer"].includes(a.stage)).length;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{qt.label}</h1>
          <p className="muted">{fmtShort(start)} – {fmtShort(end)}{isCurrent ? ` · ${daysLeft} days left` : ""}</p>
        </div>
        <div className="row">
          <Link className="btn" href={`/quarter?q=${shiftQuarter(qt, -1).year}-Q${shiftQuarter(qt, -1).q}`}>← {shiftQuarter(qt, -1).label}</Link>
          {!isCurrent ? <Link className="btn" href="/quarter">This quarter</Link> : null}
          <Link className="btn" href={`/quarter?q=${shiftQuarter(qt, 1).year}-Q${shiftQuarter(qt, 1).q}`}>{shiftQuarter(qt, 1).label} →</Link>
        </div>
      </div>

      <div className="tiles">
        <Tile label="Applications" value={qApps.length} sub={`${pastScreen} reached a screen or later`} />
        <Tile label="Workouts" value={qWorkouts} />
        <Tile label="Avg habit score" value={`${avgHabit}%`} sub="weekly average" />
        <Tile
          label="Weight change"
          value={wStart !== null && wEnd !== null ? `${wEnd - wStart > 0 ? "+" : ""}${(wEnd - wStart).toFixed(1)}` : "—"}
          sub={wEnd !== null ? `latest ${wEnd.toFixed(1)} lb` : "no weigh-ins yet"}
        />
      </div>

      <section>
        <h2>Goals this quarter</h2>
        <div className="card list">
          {qGoals.length === 0 ? <p className="empty">No goals fall in this quarter.</p> : null}
          {qGoals.map((g) => <GoalCard key={g.goal.id} item={g} today={today} />)}
        </div>
      </section>

      <div className="grid even">
        <section>
          <h2>Weight by week</h2>
          <div className="card">
            <LineChart
              title="Last weigh-in of each week, pounds"
              unit="lb"
              target={weightGoal?.target ?? null}
              points={series.map((p) => ({ label: label(p.week), value: p.weight }))}
            />
            {weightGoal?.target ? <p className="small muted">Dashed line: target of {weightGoal.target.toFixed(1)} lb.</p> : null}
          </div>
        </section>
        <section>
          <h2>Applications by week</h2>
          <div className="card">
            <BarChart
              title="Applications sent per week"
              tone="good"
              target={settings.appsPerWeek}
              futureFrom={futureFrom}
              points={series.map((p) => ({ label: label(p.week), value: p.applications }))}
            />
            <p className="small muted">Dashed line: your target of {settings.appsPerWeek} a week.</p>
          </div>
        </section>
        <section>
          <h2>Habit score by week</h2>
          <div className="card">
            <BarChart
              title="Average daily habit score per week, percent"
              max={100}
              futureFrom={futureFrom}
              points={series.map((p) => ({ label: label(p.week), value: p.habitPct }))}
            />
          </div>
        </section>
        <section>
          <h2>Workouts by week</h2>
          <div className="card">
            <BarChart
              title="Workouts logged per week"
              tone="good"
              futureFrom={futureFrom}
              points={series.map((p) => ({ label: label(p.week), value: p.workouts }))}
            />
          </div>
        </section>
      </div>

      <section>
        <h2>Pipeline</h2>
        <div className="tiles">
          {(["saved", "applied", "screen", "interview", "offer"] as const).map((s) => (
            <Tile key={s} label={STAGE_LABEL[s]} value={apps.filter((a) => a.stage === s).length} />
          ))}
        </div>
      </section>
    </>
  );
}
