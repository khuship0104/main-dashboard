import Link from "next/link";
import { WORKOUT_KINDS } from "@/lib/constants";
import {
  getApplications, getAppliedDays, getChecks, getHabits, getLogs, getOpenTodos, getSettings, getWeighIns, getWorkouts,
} from "@/lib/data";
import { addDays, dayOfWeek, fmtLong, fmtShort, isISODate, todayISO, weekStart, TZ } from "@/lib/dates";
import { goalsWithProgress } from "@/lib/goals";
import { streak, weekSummary, weighInDue } from "@/lib/stats";
import {
  applicationAdd, habitToggle, todoAdd, todoToggle, waterAdjust, waterSet, workoutAdd,
} from "../actions";
import GoalCard from "@/components/GoalCard";
import Submit from "@/components/Submit";
import WeightForm from "@/components/WeightForm";
import { DayInput, Tile } from "@/components/ui";

export default async function TodayPage({ searchParams }: { searchParams: { day?: string } }) {
  const today = todayISO();
  const day = isISODate(searchParams.day) && searchParams.day <= today ? searchParams.day : today;
  const isToday = day === today;
  const wk = weekStart(day);

  const [settings, habits, checks, logs, weighIns, todos, apps, goals, workouts, appliedDays] = await Promise.all([
    getSettings(),
    getHabits(),
    getChecks(addDays(day, -90), day),
    getLogs(addDays(day, -90), day),
    getWeighIns(),
    getOpenTodos(TZ),
    getApplications(),
    goalsWithProgress(today),
    getWorkouts(wk, addDays(wk, 6)),
    getAppliedDays(wk, addDays(wk, 6)),
  ]);

  const checkSet = new Set(checks.map((c) => `${c.habit_id}|${c.day}`));
  const log = logs.find((l) => l.day === day);
  const water = log?.water ?? 0;
  const goal = settings.waterGoal;
  const weighDue = isToday && weighInDue(today, dayOfWeek(today), weighIns);
  const lastWeigh = weighIns.filter((w) => w.day < day).at(-1);
  const dueTodos = todos.filter((t) => t.due_on && t.due_on <= day);
  const upcoming = todos.filter((t) => !t.due_on || t.due_on > day).slice(0, 4);
  const followUps = apps.filter(
    (a) => a.follow_up_on && a.follow_up_on <= day && !["rejected", "withdrawn", "offer"].includes(a.stage),
  );
  const week = weekSummary({ from: wk, upTo: day, habits, checks, logs, workouts, appliedDays, weighIns, waterGoal: goal });

  const habitsLeft = habits.filter((h) => !checkSet.has(`${h.id}|${day}`)).length;
  const left = habitsLeft + (water < goal ? 1 : 0) + (weighDue ? 1 : 0) + (isToday ? dueTodos.length : 0);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{isToday ? "Today" : fmtLong(day)}</h1>
          <p className="muted">
            {isToday ? fmtLong(day) + " · " : ""}
            {left === 0 ? "Everything's done." : `${left} thing${left === 1 ? "" : "s"} left`}
          </p>
        </div>
        <div className="row">
          <Link className="btn" href={`/?day=${addDays(day, -1)}`}>← {fmtShort(addDays(day, -1))}</Link>
          {!isToday ? <Link className="btn primary" href="/">Back to today</Link> : null}
        </div>
      </div>

      {!isToday ? <p className="banner">You&apos;re editing {fmtLong(day)}. Check-offs and water here count for that day.</p> : null}

      <div className="grid">
        <div className="stack">
          <section>
            <h2>Water</h2>
            <div className="card">
              <div className="row spread">
                <span>
                  <span className="big water-num">{water}</span> <span className="muted">of {goal} glasses</span>
                  {water > goal ? <span className="tag water" style={{ marginLeft: 8 }}>+{water - goal} extra</span> : null}
                </span>
                <div className="row" style={{ gap: 6 }}>
                  <form action={waterAdjust}>
                    <DayInput day={day} />
                    <input type="hidden" name="delta" value="-1" />
                    <Submit label="Remove a glass">−</Submit>
                  </form>
                  <form action={waterAdjust}>
                    <DayInput day={day} />
                    <input type="hidden" name="delta" value="1" />
                    <Submit className="primary" label="Add a glass">+ Glass</Submit>
                  </form>
                </div>
              </div>
              <div className="glasses" style={{ ["--n" as string]: goal }} role="group" aria-label="Glasses of water">
                {Array.from({ length: goal }, (_, i) => (
                  <form key={i} action={waterSet}>
                    <DayInput day={day} />
                    <input type="hidden" name="glasses" value={i < water && i === water - 1 ? i : i + 1} />
                    <button
                      type="submit"
                      className={`glass${i < water ? " full" : ""}`}
                      aria-label={`Set to ${i < water && i === water - 1 ? i : i + 1} glasses`}
                    />
                  </form>
                ))}
              </div>
            </div>
          </section>

          <section>
            <h2>Daily habits</h2>
            <div className="card list">
              {habits.length === 0 ? <p className="empty">No habits yet. Add some in Settings.</p> : null}
              {habits.map((h) => {
                const done = checkSet.has(`${h.id}|${day}`);
                const s = streak(day, (d) => checkSet.has(`${h.id}|${d}`));
                return (
                  <div key={h.id} className={`task${done ? " is-done" : ""}`}>
                    <form action={habitToggle}>
                      <DayInput day={day} />
                      <input type="hidden" name="habitId" value={h.id} />
                      <button type="submit" className={`check${done ? " on" : ""}`} aria-pressed={done} aria-label={h.label}>
                        {done ? "✓" : ""}
                      </button>
                    </form>
                    <div className="task-body">
                      <b>{h.label}</b>
                      {h.note ? <span>{h.note}</span> : null}
                    </div>
                    {s >= 2 ? <span className="small muted num">{s}-day streak</span> : null}
                    <span className={`tag ${h.category}`}>{h.category}</span>
                  </div>
                );
              })}
            </div>
          </section>

          <section>
            <h2>Weigh-in</h2>
            <div className="card">
              <div className="row spread">
                <div>
                  <b>{log?.weight ? `Logged ${log.weight.toFixed(1)} lb` : "Weekly weigh-in"}</b>
                  <p className="small muted">
                    {lastWeigh ? `Last: ${lastWeigh.weight.toFixed(1)} lb on ${fmtShort(lastWeigh.day)}` : "Your first weigh-in sets your starting weight."}
                  </p>
                </div>
                {weighDue ? <span className="tag due">Due</span> : null}
              </div>
              <WeightForm day={day} current={log?.weight ?? null} />
            </div>
          </section>

          <section>
            <h2>This week</h2>
            <div className="tiles">
              <Tile label="Habits done" value={`${week.habitPct}%`} />
              <Tile label="Applications" value={`${week.applications}/${settings.appsPerWeek}`} />
              <Tile label="Workouts" value={week.workouts} />
              <Tile label="Water goal days" value={`${week.waterDays}/7`} />
            </div>
          </section>
        </div>

        <div className="stack">
          <section>
            <h2>To-dos</h2>
            <div className="card">
              <div className="list">
                {dueTodos.length === 0 && upcoming.length === 0 ? <p className="empty">Nothing on your list.</p> : null}
                {[...dueTodos, ...upcoming].map((t) => (
                  <div key={t.id} className="task">
                    <form action={todoToggle}>
                      <input type="hidden" name="id" value={t.id} />
                      <button type="submit" className="check" aria-label={`Mark "${t.title}" done`} />
                    </form>
                    <div className="task-body"><b>{t.title}</b></div>
                    {t.due_on ? (
                      <span className={`tag ${t.due_on < today ? "bad" : t.due_on === today ? "due" : ""}`}>
                        {t.due_on < today ? "Overdue" : t.due_on === today ? "Today" : fmtShort(t.due_on)}
                      </span>
                    ) : null}
                  </div>
                ))}
              </div>
              <form action={todoAdd} className="row" style={{ gap: 8 }}>
                <input name="title" placeholder="Add a to-do" aria-label="New to-do" className="grow" required />
                <input name="due_on" type="date" aria-label="Due date" defaultValue={day} />
                <Submit>Add</Submit>
              </form>
              <Link href="/todos" className="small muted">All to-dos →</Link>
            </div>
          </section>

          {followUps.length ? (
            <section>
              <h2>Follow-ups due</h2>
              <div className="card list">
                {followUps.map((a) => (
                  <div key={a.id} className="row spread">
                    <div className="task-body">
                      <b>{a.company}</b>
                      <span>{a.role} · {a.stage}</span>
                    </div>
                    <span className={`tag ${a.follow_up_on! < today ? "bad" : "due"}`}>{fmtShort(a.follow_up_on!)}</span>
                  </div>
                ))}
                <Link href="/jobs" className="small muted">Open job search →</Link>
              </div>
            </section>
          ) : null}

          <section>
            <h2>Quick log</h2>
            <div className="card">
              <form action={workoutAdd} className="form-grid">
                <DayInput day={day} />
                <label className="field">
                  Workout
                  <input name="kind" list="kinds" placeholder="Strength" required />
                </label>
                <label className="field">
                  Minutes
                  <input name="minutes" type="number" min="1" max="600" inputMode="numeric" />
                </label>
                <Submit className="primary">Log workout</Submit>
                <datalist id="kinds">{WORKOUT_KINDS.map((k) => <option key={k} value={k} />)}</datalist>
              </form>
              <form action={applicationAdd} className="form-grid" style={{ borderTop: "1px solid var(--line)", paddingTop: 12 }}>
                <input type="hidden" name="applied_on" value={day} />
                <input type="hidden" name="stage" value="applied" />
                <label className="field">
                  Company
                  <input name="company" required />
                </label>
                <label className="field">
                  Role
                  <input name="role" placeholder="Data Analyst" />
                </label>
                <Submit className="primary">Log application</Submit>
              </form>
            </div>
          </section>

          <section>
            <h2>Goals</h2>
            <div className="card list">
              {goals.filter((g) => !g.goal.done).map((g) => <GoalCard key={g.goal.id} item={g} today={today} />)}
              {goals.length === 0 ? <p className="empty">No goals yet. Add one in Settings.</p> : null}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
