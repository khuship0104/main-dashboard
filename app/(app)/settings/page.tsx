import { getGoals, getHabits, getSettings, type Goal } from "@/lib/data";
import { fmtShort, todayISO } from "@/lib/dates";
import {
  goalAdd, goalDelete, goalDone, goalManual, goalUpdate, habitAdd, habitArchive, habitMove, habitUpdate, settingsSave, signOut,
} from "@/app/actions";
import Submit from "@/components/Submit";

const CATEGORY_OPTIONS = (
  <>
    <option value="health">Health</option>
    <option value="career">Career</option>
    <option value="life">Life</option>
  </>
);

const METRIC_HELP: Record<Goal["metric"], string> = {
  weight: "Tracks your weigh-ins from a starting weight to a target.",
  job: "Tracks the furthest stage any open application has reached: applied, screen, interview, offer.",
  applications: "Counts applications sent between the start and due dates.",
  workouts: "Counts workouts logged between the start and due dates.",
  manual: "You update the number yourself, like pages read or courses finished.",
};

function GoalEditor({ g }: { g: Goal }) {
  return (
    <div className="goal">
      <div className="goal-top">
        <div className="row" style={{ gap: 8 }}>
          <h3>{g.title}</h3>
          <span className={`tag ${g.category}`}>{g.category}</span>
          {g.done ? <span className="tag done">Done</span> : null}
        </div>
        <span className="small muted">{fmtShort(g.start_date)} → {fmtShort(g.due_date)}</span>
      </div>
      <p className="small muted">{METRIC_HELP[g.metric]}</p>
      <form action={goalUpdate} className="form-grid">
        <input type="hidden" name="id" value={g.id} />
        <label className="field">
          Title
          <input name="title" defaultValue={g.title} required />
        </label>
        {g.metric === "weight" ? (
          <label className="field">
            Starting weight (lb)
            <input name="start_value" type="number" step="0.1" defaultValue={g.start_value ?? ""} />
          </label>
        ) : (
          <input type="hidden" name="start_value" value={g.start_value ?? ""} />
        )}
        {g.metric !== "job" ? (
          <label className="field">
            Target {g.unit ? `(${g.unit})` : ""}
            <input name="target" type="number" step="0.1" defaultValue={g.target ?? ""} />
          </label>
        ) : (
          <input type="hidden" name="target" value="" />
        )}
        <label className="field">
          Due
          <input name="due_date" type="date" defaultValue={g.due_date} required />
        </label>
        <Submit>Save</Submit>
      </form>
      {g.metric === "manual" ? (
        <form action={goalManual} className="row" style={{ gap: 8 }}>
          <input type="hidden" name="id" value={g.id} />
          <label className="field">
            Current value
            <input name="value" type="number" step="any" defaultValue={g.current_manual ?? 0} />
          </label>
          <Submit>Update progress</Submit>
        </form>
      ) : null}
      <div className="row" style={{ gap: 6 }}>
        <form action={goalDone}>
          <input type="hidden" name="id" value={g.id} />
          <input type="hidden" name="done" value={g.done ? "false" : "true"} />
          <Submit>{g.done ? "Reopen" : "Mark achieved"}</Submit>
        </form>
        <details>
          <summary className="btn ghost danger" style={{ height: 36 }}>Delete…</summary>
          <form action={goalDelete} className="row">
            <input type="hidden" name="id" value={g.id} />
            <span className="small muted">This removes the goal, not your logged data.</span>
            <Submit className="danger">Delete goal</Submit>
          </form>
        </details>
      </div>
    </div>
  );
}

export default async function SettingsPage() {
  const today = todayISO();
  const [settings, habits, goals] = await Promise.all([getSettings(), getHabits(true), getGoals()]);
  const active = habits.filter((h) => h.active);
  const archived = habits.filter((h) => !h.active);

  return (
    <>
      <div className="page-head">
        <h1>Settings</h1>
        <form action={signOut}>
          <Submit>Sign out</Submit>
        </form>
      </div>

      <section>
        <h2>Targets</h2>
        <form action={settingsSave} className="card form-grid">
          <label className="field">
            Water, glasses a day
            <input name="water_goal" type="number" min="1" max="20" defaultValue={settings.waterGoal} />
          </label>
          <label className="field">
            Applications a week
            <input name="apps_per_week" type="number" min="0" max="100" defaultValue={settings.appsPerWeek} />
          </label>
          <Submit className="primary">Save targets</Submit>
        </form>
      </section>

      <section>
        <h2>Daily habits</h2>
        <div className="card list">
          {active.map((h, i) => (
            <div key={h.id} className="stack" style={{ gap: 8 }}>
              <form action={habitUpdate} className="form-grid">
                <input type="hidden" name="id" value={h.id} />
                <label className="field">
                  Habit
                  <input name="label" defaultValue={h.label} required />
                </label>
                <label className="field">
                  Description
                  <input name="note" defaultValue={h.note} />
                </label>
                <label className="field">
                  Category
                  <select name="category" defaultValue={h.category}>{CATEGORY_OPTIONS}</select>
                </label>
                <Submit>Save</Submit>
              </form>
              <div className="row" style={{ gap: 6 }}>
                <form action={habitMove}>
                  <input type="hidden" name="id" value={h.id} />
                  <input type="hidden" name="dir" value="-1" />
                  <button type="submit" className="ghost" disabled={i === 0} aria-label={`Move ${h.label} up`}>↑ Up</button>
                </form>
                <form action={habitMove}>
                  <input type="hidden" name="id" value={h.id} />
                  <input type="hidden" name="dir" value="1" />
                  <button type="submit" className="ghost" disabled={i === active.length - 1} aria-label={`Move ${h.label} down`}>↓ Down</button>
                </form>
                <form action={habitArchive}>
                  <input type="hidden" name="id" value={h.id} />
                  <input type="hidden" name="active" value="false" />
                  <Submit className="ghost danger">Archive</Submit>
                </form>
              </div>
            </div>
          ))}
          <form action={habitAdd} className="form-grid">
            <label className="field">
              New habit
              <input name="label" placeholder="Stretch 10 min" required />
            </label>
            <label className="field">
              Description
              <input name="note" placeholder="Optional" />
            </label>
            <label className="field">
              Category
              <select name="category" defaultValue="health">{CATEGORY_OPTIONS}</select>
            </label>
            <Submit className="primary">Add habit</Submit>
          </form>
        </div>
        {archived.length ? (
          <div className="card list">
            <p className="small muted">Archived habits keep their history and don&apos;t count toward daily scores.</p>
            {archived.map((h) => (
              <div key={h.id} className="row spread">
                <span>{h.label}</span>
                <form action={habitArchive}>
                  <input type="hidden" name="id" value={h.id} />
                  <input type="hidden" name="active" value="true" />
                  <Submit>Restore</Submit>
                </form>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <section>
        <h2>Goals</h2>
        <div className="card list">
          {goals.length === 0 ? <p className="empty">No goals yet.</p> : null}
          {goals.map((g) => <GoalEditor key={g.id} g={g} />)}
        </div>
        <details className="card">
          <summary><b>+ Add a goal</b></summary>
          <form action={goalAdd} className="form-grid">
            <label className="field">
              Title
              <input name="title" placeholder="Finish SQL course" required />
            </label>
            <label className="field">
              Area
              <select name="category" defaultValue="personal">
                <option value="personal">Personal</option>
                <option value="career">Career</option>
              </select>
            </label>
            <label className="field">
              Measured by
              <select name="metric" defaultValue="manual">
                <option value="manual">A number I update</option>
                <option value="applications">Applications sent</option>
                <option value="workouts">Workouts logged</option>
                <option value="weight">Weight</option>
                <option value="job">Job pipeline stage</option>
              </select>
            </label>
            <label className="field">
              Target
              <input name="target" type="number" step="any" placeholder="e.g. 40" />
            </label>
            <label className="field">
              Unit
              <input name="unit" placeholder="e.g. lessons" />
            </label>
            <label className="field">
              Starts
              <input name="start_date" type="date" defaultValue={today} />
            </label>
            <label className="field">
              Due
              <input name="due_date" type="date" required />
            </label>
            <label className="field">
              Starting weight (weight goals)
              <input name="start_value" type="number" step="0.1" />
            </label>
            <label className="field">
              Change in lb (weight goals)
              <input name="target_change" type="number" step="0.1" placeholder="-10" />
            </label>
            <Submit className="primary">Add goal</Submit>
          </form>
        </details>
      </section>
    </>
  );
}
