// Pure calculations: no database access, so these are easy to test.
import { addDays, daysBetween, rangeDays, weekStart } from "./dates";
import type { Check, DayLog, Goal, Habit, Stage, Workout } from "./data";

export type Status = "done" | "ahead" | "on-track" | "behind" | "not-started";

export type Progress = {
  pct: number;          // 0–100
  current: string;      // headline figure, e.g. "183.4 lb" or "3 / 20"
  detail: string;       // one supporting line
  status: Status;
  daysLeft: number;
};

export type GoalInputs = {
  today: string;
  latestWeight: number | null;
  furthestStage: Stage | null;
  count: number | null; // applications or workouts within the goal's window
};

const clamp = (n: number) => Math.max(0, Math.min(100, n));
const fmt1 = (n: number) => (Math.round(n * 10) / 10).toFixed(1);

/** Share of the goal's time window that has elapsed, 0–1. */
function elapsedFraction(g: Goal, today: string): number {
  const total = Math.max(1, daysBetween(g.start_date, g.due_date));
  return Math.max(0, Math.min(1, daysBetween(g.start_date, today) / total));
}

function paceStatus(pct: number, expectedPct: number): Status {
  if (pct >= 100) return "done";
  if (pct >= expectedPct + 10) return "ahead";
  if (pct >= expectedPct - 10) return "on-track";
  return "behind";
}

export const JOB_STEPS: Stage[] = ["applied", "screen", "interview", "offer"];

export function goalProgress(g: Goal, inp: GoalInputs): Progress {
  const daysLeft = Math.max(0, daysBetween(inp.today, g.due_date));
  const weeksLeft = Math.max(1, daysLeft / 7);
  const expected = elapsedFraction(g, inp.today) * 100;

  if (g.done) return { pct: 100, current: "Done", detail: "Marked complete", status: "done", daysLeft };

  switch (g.metric) {
    case "weight": {
      if (g.start_value === null || g.target === null) {
        return { pct: 0, current: "—", detail: "Log your first weigh-in to set the starting point", status: "not-started", daysLeft };
      }
      const current = inp.latestWeight ?? g.start_value;
      const total = g.start_value - g.target;
      const moved = g.start_value - current;
      const pct = total === 0 ? 100 : clamp((moved / total) * 100);
      const remaining = Math.max(0, current - g.target);
      const detail = remaining === 0
        ? `Reached ${fmt1(g.target)} ${g.unit}`
        : `${fmt1(Math.max(0, moved))} ${g.unit} down · ${fmt1(remaining)} to go · ${fmt1(remaining / weeksLeft)} ${g.unit}/week needed`;
      return { pct, current: `${fmt1(current)} ${g.unit}`, detail, status: paceStatus(pct, expected), daysLeft };
    }
    case "job": {
      const idx = inp.furthestStage ? JOB_STEPS.indexOf(inp.furthestStage) + 1 : 0;
      const pct = (idx / JOB_STEPS.length) * 100;
      const label = inp.furthestStage ? `Furthest: ${inp.furthestStage}` : "No applications yet";
      const status: Status = idx === JOB_STEPS.length ? "done" : idx === 0 ? "not-started" : expected > 75 && idx < 3 ? "behind" : "on-track";
      return { pct, current: label, detail: "Applied → screen → interview → offer", status, daysLeft };
    }
    case "applications":
    case "workouts":
    case "manual": {
      const value = g.metric === "manual" ? g.current_manual ?? 0 : inp.count ?? 0;
      const target = g.target ?? 0;
      const pct = target > 0 ? clamp((value / target) * 100) : 0;
      const left = Math.max(0, target - value);
      const unit = g.unit || (g.metric === "manual" ? "" : g.metric);
      const detail = left === 0 ? "Target reached" : `${left} ${unit} to go · about ${Math.ceil(left / weeksLeft)} a week`;
      const status = value === 0 && expected < 5 ? "not-started" : paceStatus(pct, expected);
      return { pct, current: `${value} / ${target} ${unit}`.trim(), detail, status, daysLeft };
    }
  }
}

// ---------- daily and weekly roll-ups ----------

export type DayScore = { day: string; done: number; total: number; pct: number; water: number; waterMet: boolean };

export function dayScores(days: string[], habits: Habit[], checks: Check[], logs: DayLog[], waterGoal: number): DayScore[] {
  const ids = new Set(habits.map((h) => h.id));
  const byDay = new Map<string, number>();
  for (const c of checks) if (ids.has(c.habit_id)) byDay.set(c.day, (byDay.get(c.day) ?? 0) + 1);
  const water = new Map(logs.map((l) => [l.day, l.water]));
  return days.map((day) => {
    const w = water.get(day) ?? 0;
    const waterMet = w >= waterGoal;
    const done = (byDay.get(day) ?? 0) + (waterMet ? 1 : 0);
    const total = habits.length + 1;
    return { day, done, total, pct: Math.round((done / total) * 100), water: w, waterMet };
  });
}

export type WeekSummary = {
  from: string;
  to: string;
  scores: DayScore[];
  habitPct: number;
  waterDays: number;
  workouts: number;
  applications: number;
  weightStart: number | null;
  weightEnd: number | null;
  perHabit: { habit: Habit; days: boolean[]; count: number }[];
};

export function weekSummary(args: {
  from: string; upTo: string; habits: Habit[]; checks: Check[]; logs: DayLog[];
  workouts: Workout[]; appliedDays: string[]; weighIns: { day: string; weight: number }[]; waterGoal: number;
}): WeekSummary {
  const to = addDays(args.from, 6);
  const days = rangeDays(args.from, to);
  const counted = days.filter((d) => d <= args.upTo);
  const scores = dayScores(days, args.habits, args.checks, args.logs, args.waterGoal);
  const countedScores = scores.filter((s) => counted.includes(s.day));
  const habitPct = countedScores.length
    ? Math.round(countedScores.reduce((s, d) => s + d.pct, 0) / countedScores.length)
    : 0;
  const checkSet = new Set(args.checks.map((c) => `${c.habit_id}|${c.day}`));
  const perHabit = args.habits.map((habit) => {
    const marks = days.map((d) => checkSet.has(`${habit.id}|${d}`));
    return { habit, days: marks, count: marks.filter(Boolean).length };
  });
  const inWeek = (d: string) => d >= args.from && d <= to;
  const before = args.weighIns.filter((w) => w.day < args.from);
  const during = args.weighIns.filter((w) => inWeek(w.day));
  return {
    from: args.from,
    to,
    scores,
    habitPct,
    waterDays: countedScores.filter((s) => s.waterMet).length,
    workouts: args.workouts.filter((w) => inWeek(w.day)).length,
    applications: args.appliedDays.filter(inWeek).length,
    weightStart: before.length ? before[before.length - 1].weight : during[0]?.weight ?? null,
    weightEnd: during.length ? during[during.length - 1].weight : null,
    perHabit,
  };
}

export type WeekPoint = { week: string; habitPct: number | null; applications: number; workouts: number; weight: number | null };

/** One point per Monday-starting week that overlaps [from, to]; future weeks get nulls/zeros. */
export function weeklySeries(args: {
  from: string; to: string; today: string; habits: Habit[]; checks: Check[]; logs: DayLog[];
  workouts: Workout[]; appliedDays: string[]; weighIns: { day: string; weight: number }[]; waterGoal: number;
}): WeekPoint[] {
  const out: WeekPoint[] = [];
  for (let wk = weekStart(args.from); wk <= args.to; wk = addDays(wk, 7)) {
    const end = addDays(wk, 6);
    const lo = wk < args.from ? args.from : wk;
    const hi = [end, args.to, args.today].sort()[0];
    const days = hi >= lo ? rangeDays(lo, hi) : [];
    const scores = dayScores(days, args.habits, args.checks, args.logs, args.waterGoal);
    const inWk = (d: string) => d >= lo && d <= end && d <= args.to;
    const w = args.weighIns.filter((x) => inWk(x.day));
    out.push({
      week: wk,
      habitPct: scores.length ? Math.round(scores.reduce((s, d) => s + d.pct, 0) / scores.length) : null,
      applications: args.appliedDays.filter(inWk).length,
      workouts: args.workouts.filter((x) => inWk(x.day)).length,
      weight: w.length ? w[w.length - 1].weight : null,
    });
  }
  return out;
}

/** Current run of consecutive days (ending today or yesterday) where `isDone` holds. */
export function streak(today: string, isDone: (day: string) => boolean): number {
  let d = isDone(today) ? today : addDays(today, -1);
  let n = 0;
  while (isDone(d)) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}

export function weighInDue(today: string, dayOfWeekToday: number, weighIns: { day: string }[]): boolean {
  if (weighIns.some((w) => w.day === today)) return false;
  const last = weighIns.length ? weighIns[weighIns.length - 1].day : null;
  if (!last) return true;
  return dayOfWeekToday === 0 || daysBetween(last, today) >= 7;
}
