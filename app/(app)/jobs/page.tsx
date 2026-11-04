import { getApplications, getAppliedDays, getSettings, STAGES, type Application } from "@/lib/data";
import { STAGE_LABEL } from "@/lib/constants";
import { addDays, fmtShort, todayISO, weekStart } from "@/lib/dates";
import { applicationAdd, applicationDelete, applicationStage, applicationUpdate } from "../../actions";
import Submit from "@/components/Submit";
import { Tile } from "@/components/ui";

const OPEN = ["saved", "applied", "screen", "interview", "offer"] as const;

function AppFields({ a, today }: { a?: Application; today: string }) {
  return (
    <>
      <label className="field">
        Company
        <input name="company" defaultValue={a?.company} required />
      </label>
      <label className="field">
        Role
        <input name="role" defaultValue={a?.role} placeholder="Data Scientist" />
      </label>
      <label className="field">
        Stage
        <select name="stage" defaultValue={a?.stage ?? "applied"}>
          {STAGES.map((s) => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}
        </select>
      </label>
      <label className="field">
        Applied on
        <input name="applied_on" type="date" defaultValue={a ? a.applied_on ?? "" : today} />
      </label>
      <label className="field">
        Follow up on
        <input name="follow_up_on" type="date" defaultValue={a?.follow_up_on ?? (a ? "" : addDays(today, 7))} />
      </label>
      <label className="field">
        Posting link
        <input name="link" type="url" inputMode="url" defaultValue={a?.link} placeholder="https://" />
      </label>
      <label className="field wide">
        Notes
        <textarea name="notes" defaultValue={a?.notes} placeholder="Referral, recruiter name, salary range, what to prep" />
      </label>
    </>
  );
}

function JobCard({ a, today }: { a: Application; today: string }) {
  const followDue = a.follow_up_on && a.follow_up_on <= today && !["rejected", "withdrawn", "offer"].includes(a.stage);
  return (
    <div className="job">
      <div className="row spread" style={{ alignItems: "flex-start" }}>
        <div style={{ minWidth: 0 }}>
          <b>{a.link ? <a href={a.link} target="_blank" rel="noreferrer">{a.company}</a> : a.company}</b>
          {a.role ? <p className="small muted">{a.role}</p> : null}
        </div>
        {followDue ? <span className="tag due">Follow up</span> : null}
      </div>
      <p className="small muted">
        {a.applied_on ? `Applied ${fmtShort(a.applied_on)}` : "Not applied yet"}
        {a.follow_up_on ? ` · follow up ${fmtShort(a.follow_up_on)}` : ""}
      </p>
      <form action={applicationStage} className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
        <input type="hidden" name="id" value={a.id} />
        <select name="stage" defaultValue={a.stage} aria-label={`Stage for ${a.company}`}>
          {STAGES.map((s) => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}
        </select>
        <Submit>Move</Submit>
      </form>
      <details>
        <summary className="small muted">Edit details</summary>
        <form action={applicationUpdate} className="form-grid">
          <input type="hidden" name="id" value={a.id} />
          <AppFields a={a} today={today} />
          <Submit className="primary">Save</Submit>
        </form>
        <form action={applicationDelete} style={{ marginTop: 8 }}>
          <input type="hidden" name="id" value={a.id} />
          <Submit className="ghost danger">Delete application</Submit>
        </form>
      </details>
    </div>
  );
}

export default async function JobsPage() {
  const today = todayISO();
  const wk = weekStart(today);
  const [apps, settings, weekApplied] = await Promise.all([getApplications(), getSettings(), getAppliedDays(wk, addDays(wk, 6))]);
  const closed = apps.filter((a) => a.stage === "rejected" || a.stage === "withdrawn");
  const active = apps.filter((a) => !closed.includes(a));
  const responded = apps.filter((a) => ["screen", "interview", "offer"].includes(a.stage)).length;
  const sent = apps.filter((a) => a.applied_on).length;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Job search</h1>
          <p className="muted">Goal: a data science role by the end of January.</p>
        </div>
      </div>

      <div className="tiles">
        <Tile label="This week" value={`${weekApplied.length}/${settings.appsPerWeek}`} sub="applications sent" />
        <Tile label="Total sent" value={sent} />
        <Tile label="In progress" value={active.filter((a) => a.stage !== "saved").length} />
        <Tile label="Response rate" value={sent ? `${Math.round((responded / sent) * 100)}%` : "—"} sub="reached a screen or later" />
      </div>

      <details className="card">
        <summary><b>+ Add an application</b></summary>
        <form action={applicationAdd} className="form-grid">
          <AppFields today={today} />
          <Submit className="primary">Add</Submit>
        </form>
      </details>

      <section>
        <h2>Pipeline</h2>
        <div className="board">
          {OPEN.map((stage) => {
            const list = active.filter((a) => a.stage === stage);
            return (
              <div key={stage} className="lane">
                <div className="lane-head">
                  <b>{STAGE_LABEL[stage]}</b>
                  <span className="num muted small">{list.length}</span>
                </div>
                {list.length === 0 ? <p className="empty small" style={{ padding: "0 4px" }}>None</p> : null}
                {list.map((a) => <JobCard key={a.id} a={a} today={today} />)}
              </div>
            );
          })}
        </div>
      </section>

      {closed.length ? (
        <details>
          <summary className="muted"><b>Closed ({closed.length})</b></summary>
          <div className="board" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
            {closed.map((a) => <JobCard key={a.id} a={a} today={today} />)}
          </div>
        </details>
      ) : null}
    </>
  );
}
