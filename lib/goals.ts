import { countApplications, countWorkouts, furthestStage, getGoals, getWeighIns, type Goal } from "./data";
import { goalProgress, type Progress } from "./stats";

export type GoalWithProgress = { goal: Goal; progress: Progress };

export async function goalsWithProgress(today: string): Promise<GoalWithProgress[]> {
  const [goals, weighIns] = await Promise.all([getGoals(), getWeighIns()]);
  const latestWeight = weighIns.length ? weighIns[weighIns.length - 1].weight : null;
  const stage = goals.some((g) => g.metric === "job") ? await furthestStage() : null;
  return Promise.all(
    goals.map(async (goal) => {
      const count =
        goal.metric === "applications" ? await countApplications(goal.start_date, goal.due_date)
        : goal.metric === "workouts" ? await countWorkouts(goal.start_date, goal.due_date)
        : null;
      return { goal, progress: goalProgress(goal, { today, latestWeight, furthestStage: goal.metric === "job" ? stage : null, count }) };
    }),
  );
}

/** Goals whose window overlaps [from, to]. */
export function overlapping(list: GoalWithProgress[], from: string, to: string) {
  return list.filter(({ goal }) => goal.start_date <= to && goal.due_date >= from);
}
