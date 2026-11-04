import { getRecentWorkouts, type Workout } from "@/lib/data";
import { WORKOUT_KINDS } from "@/lib/constants";
import { addDays, fmt, fmtShort, todayISO, weekStart } from "@/lib/dates";
import { streak } from "@/lib/stats";
import { workoutAdd, workoutDelete } from "@/app/actions";
import Submit from "@/components/Submit";
import { Tile } from "@/components/ui";

export default async function WorkoutsPage() {
  const today = todayISO();
  const recent = await getRecentWorkouts(80);
  const days = new Set(recent.map((w) => w.day));
  const wk = weekStart(today);
  const thisWeek = recent.filter((w) => w.day >= wk);
  const minutes = thisWeek.reduce((s, w) => s + (w.minutes ?? 0), 0);
  const last30 = recent.filter((w) => w.day > addDays(today, -30));

  const byWeek = new Map<string, Workout[]>();
  for (const w of recent) {
    const k = weekStart(w.day);
    byWeek.set(k, [...(byWeek.get(k) ?? []), w]);
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Workouts</h1>
          <p className="muted">Logging a workout also checks off your workout habit for that day.</p>
        </div>
      </div>

      <div className="tiles">
        <Tile label="This week" value={thisWeek.length} sub={minutes ? `${minutes} minutes` : undefined} />
        <Tile label="Streak" value={streak(today, (d) => days.has(d))} sub="days in a row" />
        <Tile label="Last 30 days" value={last30.length} />
      </div>

      <section>
        <h2>Log a workout</h2>
        <form action={workoutAdd} className="card form-grid">
          <label className="field">
            Date
            <input name="day" type="date" defaultValue={today} max={today} />
          </label>
          <label className="field">
            Type
            <input name="kind" list="kinds-w" placeholder="Strength" required />
          </label>
          <label className="field">
            Minutes
            <input name="minutes" type="number" min="1" max="600" inputMode="numeric" />
          </label>
          <label className="field wide">
            Notes
            <input name="notes" placeholder="Leg day: squats 3×8 at 95 lb, lunges, 10 min incline walk" />
          </label>
          <Submit className="primary">Log workout</Submit>
          <datalist id="kinds-w">{WORKOUT_KINDS.map((k) => <option key={k} value={k} />)}</datalist>
        </form>
      </section>

      <section>
        <h2>History</h2>
        {recent.length === 0 ? <p className="empty">No workouts yet. Your first one shows up here.</p> : null}
        <div className="stack">
          {[...byWeek.entries()].map(([week, list]) => (
            <div key={week} className="card">
              <div className="card-head">
                <h3>Week of {fmtShort(week)}</h3>
                <span className="small muted num">{list.length} workout{list.length === 1 ? "" : "s"}</span>
              </div>
              <div className="list">
                {list.map((w) => (
                  <div key={w.id} className="task">
                    <div className="task-body">
                      <b>{w.kind}{w.minutes ? <span className="num"> · {w.minutes} min</span> : null}</b>
                      <span>{fmt(w.day, { weekday: "short", month: "short", day: "numeric" })}{w.notes ? ` · ${w.notes}` : ""}</span>
                    </div>
                    <form action={workoutDelete}>
                      <input type="hidden" name="id" value={w.id} />
                      <Submit className="ghost" label={`Delete ${w.kind} on ${fmtShort(w.day)}`}>✕</Submit>
                    </form>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
