import { q } from "./db";

// ---------- types ----------

export type Category = "health" | "career" | "life";
export type Habit = { id: number; slug: string | null; label: string; note: string; category: Category; sort: number; active: boolean };
export type Check = { habit_id: number; day: string };
export type DayLog = { day: string; water: number; weight: number | null };
export type Workout = { id: number; day: string; kind: string; minutes: number | null; notes: string };
export type Todo = { id: number; title: string; due_on: string | null; done: boolean; done_on: string | null };
export const STAGES = ["saved", "applied", "screen", "interview", "offer", "rejected", "withdrawn"] as const;
export type Stage = (typeof STAGES)[number];
export type Application = {
  id: number; company: string; role: string; link: string; stage: Stage;
  applied_on: string | null; follow_up_on: string | null; notes: string; updated_on: string;
};
export type Metric = "weight" | "job" | "applications" | "workouts" | "manual";
export const METRICS: Metric[] = ["weight", "job", "applications", "workouts", "manual"];
export type Goal = {
  id: number; title: string; category: "personal" | "career"; metric: Metric;
  start_value: number | null; target: number | null; target_change: number | null; current_manual: number | null;
  unit: string; start_date: string; due_date: string; done: boolean;
};
export type Settings = { waterGoal: number; appsPerWeek: number };

const num = (v: unknown): number | null => (v === null || v === undefined || v === "" ? null : Number(v));

// ---------- settings ----------

export async function getSettings(): Promise<Settings> {
  const rows = await q<{ key: string; value: unknown }>("select key, value from settings");
  const m = new Map(rows.map((r) => [r.key, r.value]));
  return {
    waterGoal: Number(m.get("water_goal") ?? 8) || 8,
    appsPerWeek: Number(m.get("apps_per_week") ?? 5) || 5,
  };
}

export async function setSetting(key: "water_goal" | "apps_per_week", value: number) {
  await q(
    "insert into settings (key, value) values ($1, $2::jsonb) on conflict (key) do update set value = excluded.value",
    [key, JSON.stringify(value)],
  );
}

// ---------- habits ----------

const HABIT_COLS = "id, slug, label, note, category, sort, active";

export async function getHabits(includeArchived = false): Promise<Habit[]> {
  return q<Habit>(
    `select ${HABIT_COLS} from habits ${includeArchived ? "" : "where active"} order by active desc, sort, id`,
  );
}

export async function addHabit(label: string, note: string, category: Category) {
  await q(
    "insert into habits (label, note, category, sort) values ($1, $2, $3, coalesce((select max(sort) from habits), 0) + 1)",
    [label, note, category],
  );
}

export async function updateHabit(id: number, label: string, note: string, category: Category) {
  await q("update habits set label = $2, note = $3, category = $4 where id = $1", [id, label, note, category]);
}

export async function setHabitActive(id: number, active: boolean) {
  await q("update habits set active = $2 where id = $1", [id, active]);
}

export async function moveHabit(id: number, dir: -1 | 1) {
  // Swap sort with the neighbour above or below among active habits.
  await q(
    `with me as (select id, sort from habits where id = $1),
          other as (
            select h.id, h.sort from habits h, me
            where h.active and h.id <> me.id
              and (case when $2 < 0 then h.sort < me.sort else h.sort > me.sort end)
            order by case when $2 < 0 then -h.sort else h.sort end
            limit 1)
     update habits h set sort = case when h.id = me.id then other.sort else me.sort end
     from me, other where h.id in (me.id, other.id)`,
    [id, dir],
  );
}

export async function getChecks(from: string, to: string): Promise<Check[]> {
  return q<Check>("select habit_id, day::text as day from habit_checks where day between $1 and $2", [from, to]);
}

export async function toggleCheck(habitId: number, day: string) {
  const del = await q("delete from habit_checks where habit_id = $1 and day = $2 returning habit_id", [habitId, day]);
  if (del.length === 0) {
    await q("insert into habit_checks (habit_id, day) values ($1, $2) on conflict do nothing", [habitId, day]);
  }
}

async function checkBySlug(slug: string, day: string) {
  await q(
    "insert into habit_checks (habit_id, day) select id, $2 from habits where slug = $1 and active on conflict do nothing",
    [slug, day],
  );
}

// ---------- daily log: water and weight ----------

function toDayLog(r: { day: string; water: number; weight: unknown }): DayLog {
  return { day: r.day, water: Number(r.water), weight: num(r.weight) };
}

export async function getLogs(from: string, to: string): Promise<DayLog[]> {
  const rows = await q<{ day: string; water: number; weight: unknown }>(
    "select day::text as day, water, weight from daily_log where day between $1 and $2 order by day",
    [from, to],
  );
  return rows.map(toDayLog);
}

export async function adjustWater(day: string, delta: number) {
  await q(
    `insert into daily_log (day, water) values ($1, greatest($2::int, 0))
     on conflict (day) do update set water = greatest(daily_log.water + $2::int, 0)`,
    [day, delta],
  );
}

export async function setWater(day: string, glasses: number) {
  await q(
    "insert into daily_log (day, water) values ($1, $2) on conflict (day) do update set water = excluded.water",
    [day, Math.max(0, Math.round(glasses))],
  );
}

export async function getWeighIns(from = "1900-01-01", to = "9999-12-31"): Promise<{ day: string; weight: number }[]> {
  const rows = await q<{ day: string; weight: unknown }>(
    "select day::text as day, weight from daily_log where weight is not null and day between $1 and $2 order by day",
    [from, to],
  );
  return rows.map((r) => ({ day: r.day, weight: Number(r.weight) }));
}

export async function logWeight(day: string, weight: number | null) {
  await q(
    "insert into daily_log (day, weight) values ($1, $2) on conflict (day) do update set weight = excluded.weight",
    [day, weight],
  );
  if (weight !== null) {
    // The first weigh-in becomes the starting point for weight goals that set their target relative to it.
    await q(
      `update goals set start_value = $1, target = $1 + target_change
       where metric = 'weight' and start_value is null and target_change is not null`,
      [weight],
    );
  }
}

// ---------- workouts ----------

const WORKOUT_COLS = "id, day::text as day, kind, minutes, notes";

export async function getWorkouts(from: string, to: string): Promise<Workout[]> {
  return q<Workout>(`select ${WORKOUT_COLS} from workouts where day between $1 and $2 order by day desc, id desc`, [from, to]);
}

export async function getRecentWorkouts(limit = 30): Promise<Workout[]> {
  return q<Workout>(`select ${WORKOUT_COLS} from workouts order by day desc, id desc limit $1`, [limit]);
}

export async function addWorkout(day: string, kind: string, minutes: number | null, notes: string) {
  await q("insert into workouts (day, kind, minutes, notes) values ($1, $2, $3, $4)", [day, kind, minutes, notes]);
  await checkBySlug("workout", day);
}

export async function deleteWorkout(id: number) {
  await q("delete from workouts where id = $1", [id]);
}

// ---------- to-dos ----------

const TODO_COLS = "id, title, due_on::text as due_on, done_at is not null as done, (done_at at time zone $1)::date::text as done_on";

export async function getOpenTodos(tz: string): Promise<Todo[]> {
  return q<Todo>(
    `select ${TODO_COLS} from todos where done_at is null order by due_on nulls last, id`,
    [tz],
  );
}

export async function getDoneTodos(tz: string, limit = 20): Promise<Todo[]> {
  return q<Todo>(`select ${TODO_COLS} from todos where done_at is not null order by done_at desc limit $2`, [tz, limit]);
}

export async function countTodosDone(tz: string, from: string, to: string): Promise<number> {
  const [r] = await q<{ n: number }>(
    "select count(*)::int as n from todos where done_at is not null and (done_at at time zone $1)::date between $2 and $3",
    [tz, from, to],
  );
  return r?.n ?? 0;
}

export async function addTodo(title: string, dueOn: string | null) {
  await q("insert into todos (title, due_on) values ($1, $2)", [title, dueOn]);
}

export async function toggleTodo(id: number) {
  await q("update todos set done_at = case when done_at is null then now() else null end where id = $1", [id]);
}

export async function deleteTodo(id: number) {
  await q("delete from todos where id = $1", [id]);
}

// ---------- job applications ----------

const APP_COLS = `id, company, role, link, stage, applied_on::text as applied_on, follow_up_on::text as follow_up_on,
  notes, updated_at::date::text as updated_on`;

export async function getApplications(): Promise<Application[]> {
  return q<Application>(`select ${APP_COLS} from applications order by updated_at desc, id desc`);
}

export async function getAppliedDays(from: string, to: string): Promise<string[]> {
  const rows = await q<{ day: string }>(
    "select applied_on::text as day from applications where applied_on between $1 and $2",
    [from, to],
  );
  return rows.map((r) => r.day);
}

export async function addApplication(a: {
  company: string; role: string; link: string; stage: Stage; applied_on: string | null; follow_up_on: string | null; notes: string;
}) {
  await q(
    `insert into applications (company, role, link, stage, applied_on, follow_up_on, notes)
     values ($1, $2, $3, $4, $5, $6, $7)`,
    [a.company, a.role, a.link, a.stage, a.applied_on, a.follow_up_on, a.notes],
  );
  if (a.applied_on) await checkBySlug("jobsearch", a.applied_on);
}

export async function updateApplication(id: number, a: {
  company: string; role: string; link: string; stage: Stage; applied_on: string | null; follow_up_on: string | null; notes: string;
}) {
  await q(
    `update applications set company = $2, role = $3, link = $4, stage = $5, applied_on = $6, follow_up_on = $7,
       notes = $8, updated_at = now() where id = $1`,
    [id, a.company, a.role, a.link, a.stage, a.applied_on, a.follow_up_on, a.notes],
  );
}

export async function setApplicationStage(id: number, stage: Stage, today: string) {
  // Moving a saved posting forward stamps today as the applied date.
  await q(
    `update applications set stage = $2, updated_at = now(),
       applied_on = case when applied_on is null and $2 <> 'saved' and $2 <> 'withdrawn' then $3::date else applied_on end
     where id = $1`,
    [id, stage, today],
  );
}

export async function deleteApplication(id: number) {
  await q("delete from applications where id = $1", [id]);
}

// ---------- goals ----------

type GoalRow = Omit<Goal, "start_value" | "target" | "target_change" | "current_manual"> & {
  start_value: unknown; target: unknown; target_change: unknown; current_manual: unknown;
};

export async function getGoals(): Promise<Goal[]> {
  const rows = await q<GoalRow>(
    `select id, title, category, metric, start_value, target, target_change, current_manual, unit,
            start_date::text as start_date, due_date::text as due_date, done_at is not null as done
     from goals order by done_at is not null, due_date, id`,
  );
  return rows.map((r) => ({
    ...r,
    start_value: num(r.start_value),
    target: num(r.target),
    target_change: num(r.target_change),
    current_manual: num(r.current_manual),
  }));
}

export async function addGoal(g: {
  title: string; category: "personal" | "career"; metric: Metric; start_value: number | null; target: number | null;
  target_change: number | null; unit: string; start_date: string; due_date: string;
}) {
  await q(
    `insert into goals (title, category, metric, start_value, target, target_change, current_manual, unit, start_date, due_date)
     values ($1, $2, $3, $4, $5, $6, case when $3 = 'manual' then 0 end, $7, $8, $9)`,
    [g.title, g.category, g.metric, g.start_value, g.target, g.target_change, g.unit, g.start_date, g.due_date],
  );
}

export async function updateGoal(id: number, g: { title: string; target: number | null; start_value: number | null; due_date: string }) {
  await q("update goals set title = $2, target = $3, start_value = $4, due_date = $5 where id = $1", [
    id, g.title, g.target, g.start_value, g.due_date,
  ]);
}

export async function setGoalManual(id: number, value: number) {
  await q("update goals set current_manual = $2 where id = $1", [id, value]);
}

export async function setGoalDone(id: number, done: boolean) {
  await q("update goals set done_at = case when $2 then now() else null end where id = $1", [id, done]);
}

export async function deleteGoal(id: number) {
  await q("delete from goals where id = $1", [id]);
}

// ---------- goal progress inputs ----------

/** Furthest stage reached by any application still in play (rejected and withdrawn ones don't count). */
export async function furthestStage(): Promise<Stage | null> {
  const [r] = await q<{ stage: Stage | null }>(
    `select stage from applications
     where stage in ('applied', 'screen', 'interview', 'offer')
     order by array_position(array['applied','screen','interview','offer'], stage) desc limit 1`,
  );
  return r?.stage ?? null;
}

export async function countApplications(from: string, to: string): Promise<number> {
  const [r] = await q<{ n: number }>("select count(*)::int as n from applications where applied_on between $1 and $2", [from, to]);
  return r?.n ?? 0;
}

export async function countWorkouts(from: string, to: string): Promise<number> {
  const [r] = await q<{ n: number }>("select count(*)::int as n from workouts where day between $1 and $2", [from, to]);
  return r?.n ?? 0;
}
