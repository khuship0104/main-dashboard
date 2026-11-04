import Link from "next/link";
import { countTodosDone, getAppliedDays, getChecks, getHabits, getLogs, getSettings, getWeighIns, getWorkouts } from "@/lib/data";
import { addDays, fmt, fmtShort, isISODate, rangeDays, todayISO, weekStart, TZ } from "@/lib/dates";
import { goalsWithProgress, overlapping } from "@/lib/goals";
import { weekSummary } from "@/lib/stats";
import GoalCard from "@/components/GoalCard";
import { BarChart } from "@/components/Charts";
import { Tile } from "@/components/ui";

export default async function WeekPage({ searchParams }: { searchParams: { d?: string } }) {
  const today = todayISO();
  const from = weekStart(isISODate(searchParams.d) ? searchParams.d : today);
  const to = addDays(from, 6);
  const isCurrent = today >= from && today <= to;
  const upTo = isCurrent ? today : to < today ? to : addDays(from, -1);

  const [settings, habits, checks, logs, weighIns, workouts, appliedDays, todosDone, goals] = await Promise.all([
    getSettings(), getHabits(), getChecks(from, to), getLogs(from, to), getWeighIns(),
    getWorkouts(from, to), getAppliedDays(from, to), countTodosDone(TZ, from, to), goalsWithProgress(today),
  ]);

  const s = weekSummary({ from, upTo, habits, checks, logs, workouts, appliedDays, weighIns, waterGoal: settings.waterGoal });
  const days = rangeDays(from, to);
  const change = s.weightStart !== null && s.weightEnd !== null ? s.weightEnd - s.weightStart : null;
  const elapsed = days.filter((d) => d <= upTo).length;
  const weekGoals = overlapping(goals, from, to).filter((g) => !g.goal.done);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Week of {fmtShort(from)}</h1>
          <p className="muted">{fmtShort(from)} – {fmtShort(to)}{isCurrent ? ` · ${7 - elapsed} days left` : ""}</p>
        </div>
        <div className="row">
          <Link className="btn" href={`/week?d=${addDays(from, -7)}`}>← Previous</Link>
          {!isCurrent ? <Link className="btn" href="/week">This week</Link> : null}
          <Link className="btn" href={`/week?d=${addDays(from, 7)}`}>Next →</Link>
        </div>
      </div>

      <div className="tiles">
        <Tile label="Habits done" value={`${s.habitPct}%`} sub={elapsed ? `average over ${elapsed} day${elapsed === 1 ? "" : "s"}` : "week hasn't started"} />
        <Tile label="Applications" value={`${s.applications}/${settings.appsPerWeek}`} sub={s.applications >= settings.appsPerWeek ? "weekly target met" : `${settings.appsPerWeek - s.applications} to go`} />
        <Tile label="Workouts" value={s.workouts} />
        <Tile label="Water goal met" value={`${s.waterDays}/${elapsed || 7}`} sub={`days at ${settings.waterGoal}+ glasses`} />
        <Tile
          label="Weight change"
          value={change === null ? "—" : `${change > 0 ? "+" : ""}${change.toFixed(1)}`}
          sub={s.weightEnd !== null ? `now ${s.weightEnd.toFixed(1)} lb` : "no weigh-in this week"}
        />
        <Tile label="To-dos done" value={todosDone} />
      </div>

      <section>
        <h2>Habit grid</h2>
        <div className="card scroll-x">
          <table className="grid7">
            <thead>
              <tr>
                <th scope="col">Habit</th>
                {days.map((d) => (
                  <th key={d} scope="col" className={d === today ? "today" : undefined}>
                    {fmt(d, { weekday: "short" })}
                    <br />
                    <span className="num">{fmt(d, { day: "numeric" })}</span>
                  </th>
                ))}
                <th scope="col">Total</th>
              </tr>
            </thead>
            <tbody>
              {s.perHabit.map(({ habit, days: marks, count }) => (
                <tr key={habit.id}>
                  <td>{habit.label}</td>
                  {marks.map((on, i) => (
                    <td key={i} className={days[i] === today ? "today" : undefined}>
                      <Link href={`/?day=${days[i]}`} aria-label={`${habit.label}, ${fmtShort(days[i])}: ${on ? "done" : "not done"}`}>
                        <span className={`dot${on ? " on" : ""}${days[i] > today ? " future" : ""}`} />
                      </Link>
                    </td>
                  ))}
                  <td className="num">{count}</td>
                </tr>
              ))}
              <tr>
                <td>Water ({settings.waterGoal}+)</td>
                {s.scores.map((sc) => (
                  <td key={sc.day} className={sc.day === today ? "today" : undefined} title={`${sc.water} glasses`}>
                    <span className={`dot${sc.waterMet ? " water" : ""}${sc.day > today ? " future" : ""}`} />
                  </td>
                ))}
                <td className="num">{s.scores.filter((x) => x.waterMet).length}</td>
              </tr>
              <tr>
                <td>Day score</td>
                {s.scores.map((sc) => (
                  <td key={sc.day} className={`num${sc.day === today ? " today" : ""}`}>{sc.day > today ? "" : `${sc.pct}%`}</td>
                ))}
                <td />
              </tr>
            </tbody>
          </table>
        </div>
        <p className="small muted">Tap a square to open that day and fix a check-off.</p>
      </section>

      <div className="grid even">
        <section>
          <h2>Water by day</h2>
          <div className="card">
            <BarChart
              title="Glasses of water per day"
              points={s.scores.map((sc) => ({ label: fmt(sc.day, { weekday: "short" }), value: sc.day > today ? null : sc.water }))}
              target={settings.waterGoal}
              futureFrom={days.findIndex((d) => d > today) === -1 ? undefined : days.findIndex((d) => d > today)}
            />
          </div>
        </section>
        <section>
          <h2>Workouts</h2>
          <div className="card list">
            {workouts.length === 0 ? <p className="empty">No workouts logged this week.</p> : null}
            {[...workouts].reverse().map((w) => (
              <div key={w.id} className="row spread">
                <div className="task-body">
                  <b>{w.kind}</b>
                  <span>{fmt(w.day, { weekday: "long" })}{w.notes ? ` · ${w.notes}` : ""}</span>
                </div>
                {w.minutes ? <span className="num small">{w.minutes} min</span> : null}
              </div>
            ))}
          </div>
        </section>
      </div>

      <section>
        <h2>Goal progress</h2>
        <div className="card list">
          {weekGoals.length === 0 ? <p className="empty">No active goals this week.</p> : null}
          {weekGoals.map((g) => <GoalCard key={g.goal.id} item={g} today={today} />)}
        </div>
      </section>
    </>
  );
}
