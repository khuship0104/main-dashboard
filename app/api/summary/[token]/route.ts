// Read-only snapshot for the scheduled reminders (morning brief, water, weigh-in).
// Protected by SUMMARY_TOKEN in the URL so a plain web fetch can read it. Rotate the token to revoke access.
import { NextResponse } from "next/server";
import { safeEqual } from "@/lib/auth";
import { addDays, dayOfWeek, todayISO, weekStart, TZ } from "@/lib/dates";
import { getApplications, getChecks, getHabits, getLogs, getOpenTodos, getSettings, getWeighIns, getWorkouts, getAppliedDays } from "@/lib/data";
import { goalsWithProgress } from "@/lib/goals";
import { dayScores, streak, weekSummary, weighInDue } from "@/lib/stats";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { token: string } }) {
  const expected = process.env.SUMMARY_TOKEN;
  if (!expected || expected.length < 24 || !(await safeEqual(params.token, expected))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const today = todayISO();
  const from = addDays(today, -60);
  const wk = weekStart(today);
  const [settings, habits, checks, logs, weighIns, workouts, appliedDays, todos, apps, goals] = await Promise.all([
    getSettings(), getHabits(), getChecks(from, today), getLogs(from, today), getWeighIns(),
    getWorkouts(wk, addDays(wk, 6)), getAppliedDays(wk, addDays(wk, 6)), getOpenTodos(TZ), getApplications(), goalsWithProgress(today),
  ]);

  const checkSet = new Set(checks.map((c) => `${c.habit_id}|${c.day}`));
  const todayLog = logs.find((l) => l.day === today);
  const [yesterday] = dayScores([addDays(today, -1)], habits, checks, logs, settings.waterGoal);
  const week = weekSummary({ from: wk, upTo: today, habits, checks, logs, workouts, appliedDays, weighIns, waterGoal: settings.waterGoal });
  const lastWeigh = weighIns.at(-1) ?? null;

  return NextResponse.json(
    {
      date: today,
      timezone: TZ,
      weekday: new Date().toLocaleDateString("en-US", { weekday: "long", timeZone: TZ }),
      water: { glasses: todayLog?.water ?? 0, goal: settings.waterGoal },
      habits: habits.map((h) => ({
        label: h.label,
        category: h.category,
        doneToday: checkSet.has(`${h.id}|${today}`),
        streak: streak(today, (d) => checkSet.has(`${h.id}|${d}`)),
      })),
      weighIn: { due: weighInDue(today, dayOfWeek(today), weighIns), last: lastWeigh },
      yesterday: { done: yesterday.done, total: yesterday.total, waterGlasses: yesterday.water },
      thisWeek: {
        from: week.from,
        habitPct: week.habitPct,
        waterDaysMet: week.waterDays,
        workouts: week.workouts,
        applications: week.applications,
        applicationsTarget: settings.appsPerWeek,
      },
      todos: {
        overdue: todos.filter((t) => t.due_on && t.due_on < today).map((t) => ({ title: t.title, due: t.due_on })),
        dueToday: todos.filter((t) => t.due_on === today).map((t) => t.title),
      },
      followUpsDue: apps
        .filter((a) => a.follow_up_on && a.follow_up_on <= today && !["rejected", "withdrawn", "offer"].includes(a.stage))
        .map((a) => ({ company: a.company, role: a.role, stage: a.stage, followUp: a.follow_up_on })),
      pipeline: Object.fromEntries(
        ["saved", "applied", "screen", "interview", "offer"].map((s) => [s, apps.filter((a) => a.stage === s).length]),
      ),
      goals: goals.map(({ goal, progress }) => ({
        title: goal.title,
        due: goal.due_date,
        daysLeft: progress.daysLeft,
        pct: Math.round(progress.pct),
        current: progress.current,
        detail: progress.detail,
        status: progress.status,
      })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
