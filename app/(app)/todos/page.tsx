import { getDoneTodos, getOpenTodos, type Todo } from "@/lib/data";
import { addDays, fmtShort, todayISO, TZ } from "@/lib/dates";
import { todoAdd, todoDelete, todoToggle } from "@/app/actions";
import Submit from "@/components/Submit";

function Item({ t, today }: { t: Todo; today: string }) {
  return (
    <div className={`task${t.done ? " is-done" : ""}`}>
      <form action={todoToggle}>
        <input type="hidden" name="id" value={t.id} />
        <button type="submit" className={`check${t.done ? " on" : ""}`} aria-pressed={t.done} aria-label={t.title}>
          {t.done ? "✓" : ""}
        </button>
      </form>
      <div className="task-body">
        <b>{t.title}</b>
        {t.done && t.done_on ? <span>Done {fmtShort(t.done_on)}</span> : null}
      </div>
      {!t.done && t.due_on ? (
        <span className={`tag ${t.due_on < today ? "bad" : t.due_on === today ? "due" : ""}`}>{fmtShort(t.due_on)}</span>
      ) : null}
      <form action={todoDelete}>
        <input type="hidden" name="id" value={t.id} />
        <Submit className="ghost" label={`Delete "${t.title}"`}>✕</Submit>
      </form>
    </div>
  );
}

export default async function TodosPage() {
  const today = todayISO();
  const [open, done] = await Promise.all([getOpenTodos(TZ), getDoneTodos(TZ)]);
  const weekEnd = addDays(today, 7);
  const groups: { title: string; items: Todo[] }[] = [
    { title: "Overdue", items: open.filter((t) => t.due_on && t.due_on < today) },
    { title: "Today", items: open.filter((t) => t.due_on === today) },
    { title: "Next 7 days", items: open.filter((t) => t.due_on && t.due_on > today && t.due_on <= weekEnd) },
    { title: "Later", items: open.filter((t) => t.due_on && t.due_on > weekEnd) },
    { title: "No date", items: open.filter((t) => !t.due_on) },
  ];

  return (
    <>
      <div className="page-head">
        <div>
          <h1>To-dos</h1>
          <p className="muted">{open.length} open</p>
        </div>
      </div>

      <form action={todoAdd} className="card row">
        <input name="title" placeholder="What needs doing?" aria-label="New to-do" className="grow" required />
        <input name="due_on" type="date" aria-label="Due date" />
        <Submit className="primary">Add to-do</Submit>
      </form>

      <div className="grid even">
        <div className="stack">
          {groups.filter((g) => g.items.length).map((g) => (
            <section key={g.title}>
              <h2>{g.title}</h2>
              <div className="card list">{g.items.map((t) => <Item key={t.id} t={t} today={today} />)}</div>
            </section>
          ))}
          {open.length === 0 ? <p className="empty">Nothing open. Add a to-do above.</p> : null}
        </div>
        <section>
          <h2>Recently done</h2>
          <div className="card list">
            {done.length === 0 ? <p className="empty">Finished to-dos show up here.</p> : null}
            {done.map((t) => <Item key={t.id} t={t} today={today} />)}
          </div>
        </section>
      </div>
    </>
  );
}
