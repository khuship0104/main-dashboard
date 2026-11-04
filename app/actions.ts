"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import * as db from "@/lib/data";
import { STAGES, METRICS, type Stage, type Metric, type Category } from "@/lib/data";
import { isISODate, todayISO, TZ } from "@/lib/dates";
import { SESSION_COOKIE, SESSION_DAYS, checkPassword, createSession } from "@/lib/auth";
import { requireAuth } from "@/lib/session";

// ---------- form helpers ----------

const str = (f: FormData, k: string, max = 500) => String(f.get(k) ?? "").trim().slice(0, max);
const id = (f: FormData, k = "id") => {
  const n = Number(f.get(k));
  if (!Number.isInteger(n) || n <= 0) throw new Error(`Invalid ${k}`);
  return n;
};
const optNum = (f: FormData, k: string): number | null => {
  const s = str(f, k, 20);
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) throw new Error(`${k} must be a number`);
  return n;
};
const optDate = (f: FormData, k: string): string | null => {
  const s = str(f, k, 10);
  return s && isISODate(s) ? s : null;
};
const day = (f: FormData) => optDate(f, "day") ?? todayISO();
const oneOf = <T extends string>(v: string, list: readonly T[], fallback: T): T =>
  (list as readonly string[]).includes(v) ? (v as T) : fallback;
const safeUrl = (s: string) => (/^https?:\/\//i.test(s) ? s : s ? `https://${s}` : "");

function refresh() {
  revalidatePath("/", "layout");
}

// ---------- sign-in ----------

export async function signIn(_prev: { error?: string } | undefined, f: FormData) {
  const ok = await checkPassword(String(f.get("password") ?? ""));
  if (!ok) {
    await new Promise((r) => setTimeout(r, 700));
    return { error: "That password didn't match. Try again." };
  }
  cookies().set(SESSION_COOKIE, await createSession(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 86_400,
  });
  const next = String(f.get("next") ?? "/");
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/");
}

export async function signOut() {
  cookies().delete(SESSION_COOKIE);
  redirect("/login");
}

// ---------- today: water, habits, weight ----------

export async function waterAdjust(f: FormData) {
  await requireAuth();
  const delta = Number(f.get("delta"));
  if (![1, -1].includes(delta)) throw new Error("Invalid water change");
  await db.adjustWater(day(f), delta);
  refresh();
}

export async function waterSet(f: FormData) {
  await requireAuth();
  const n = Number(f.get("glasses"));
  if (!Number.isInteger(n) || n < 0 || n > 30) throw new Error("Invalid glasses");
  await db.setWater(day(f), n);
  refresh();
}

export async function habitToggle(f: FormData) {
  await requireAuth();
  await db.toggleCheck(id(f, "habitId"), day(f));
  refresh();
}

export async function weightLog(_prev: { error?: string; ok?: boolean } | undefined, f: FormData) {
  await requireAuth();
  const w = optNum(f, "weight");
  if (w !== null && !(w > 50 && w < 800)) return { error: "Enter your weight in pounds, like 172.4." };
  await db.logWeight(day(f), w === null ? null : Math.round(w * 10) / 10);
  refresh();
  return { ok: true };
}

// ---------- workouts ----------

export async function workoutAdd(f: FormData) {
  await requireAuth();
  const kind = str(f, "kind", 60) || "Workout";
  const minutes = optNum(f, "minutes");
  await db.addWorkout(day(f), kind, minutes && minutes > 0 ? Math.min(600, Math.round(minutes)) : null, str(f, "notes", 1000));
  refresh();
}

export async function workoutDelete(f: FormData) {
  await requireAuth();
  await db.deleteWorkout(id(f));
  refresh();
}

// ---------- to-dos ----------

export async function todoAdd(f: FormData) {
  await requireAuth();
  const title = str(f, "title", 200);
  if (!title) return;
  await db.addTodo(title, optDate(f, "due_on"));
  refresh();
}

export async function todoToggle(f: FormData) {
  await requireAuth();
  await db.toggleTodo(id(f));
  refresh();
}

export async function todoDelete(f: FormData) {
  await requireAuth();
  await db.deleteTodo(id(f));
  refresh();
}

// ---------- applications ----------

function appFields(f: FormData) {
  const stage = oneOf<Stage>(str(f, "stage", 20), STAGES, "applied");
  return {
    company: str(f, "company", 120),
    role: str(f, "role", 160),
    link: safeUrl(str(f, "link", 500)),
    stage,
    applied_on: optDate(f, "applied_on") ?? (stage === "saved" ? null : todayISO()),
    follow_up_on: optDate(f, "follow_up_on"),
    notes: str(f, "notes", 2000),
  };
}

export async function applicationAdd(f: FormData) {
  await requireAuth();
  const a = appFields(f);
  if (!a.company) return;
  await db.addApplication(a);
  refresh();
}

export async function applicationUpdate(f: FormData) {
  await requireAuth();
  const a = appFields(f);
  if (!a.company) return;
  await db.updateApplication(id(f), a);
  refresh();
}

export async function applicationStage(f: FormData) {
  await requireAuth();
  await db.setApplicationStage(id(f), oneOf<Stage>(str(f, "stage", 20), STAGES, "applied"), todayISO());
  refresh();
}

export async function applicationDelete(f: FormData) {
  await requireAuth();
  await db.deleteApplication(id(f));
  refresh();
}

// ---------- habits and settings ----------

const CATS: Category[] = ["health", "career", "life"];

export async function habitAdd(f: FormData) {
  await requireAuth();
  const label = str(f, "label", 80);
  if (!label) return;
  await db.addHabit(label, str(f, "note", 200), oneOf(str(f, "category"), CATS, "health"));
  refresh();
}

export async function habitUpdate(f: FormData) {
  await requireAuth();
  const label = str(f, "label", 80);
  if (!label) return;
  await db.updateHabit(id(f), label, str(f, "note", 200), oneOf(str(f, "category"), CATS, "health"));
  refresh();
}

export async function habitArchive(f: FormData) {
  await requireAuth();
  await db.setHabitActive(id(f), str(f, "active") === "true");
  refresh();
}

export async function habitMove(f: FormData) {
  await requireAuth();
  await db.moveHabit(id(f), Number(f.get("dir")) < 0 ? -1 : 1);
  refresh();
}

export async function settingsSave(f: FormData) {
  await requireAuth();
  const water = optNum(f, "water_goal");
  const apps = optNum(f, "apps_per_week");
  if (water !== null && water >= 1 && water <= 20) await db.setSetting("water_goal", Math.round(water));
  if (apps !== null && apps >= 0 && apps <= 100) await db.setSetting("apps_per_week", Math.round(apps));
  refresh();
}

// ---------- goals ----------

export async function goalAdd(f: FormData) {
  await requireAuth();
  const title = str(f, "title", 120);
  const due = optDate(f, "due_date");
  if (!title || !due) return;
  const metric = oneOf<Metric>(str(f, "metric"), METRICS, "manual");
  const target = optNum(f, "target");
  const change = metric === "weight" ? optNum(f, "target_change") : null;
  const start = metric === "weight" ? optNum(f, "start_value") : null;
  await db.addGoal({
    title,
    category: str(f, "category") === "career" ? "career" : "personal",
    metric,
    start_value: start,
    target: metric === "weight" && start !== null && change !== null ? start + change : target,
    target_change: change,
    unit: str(f, "unit", 20) || (metric === "weight" ? "lb" : ""),
    start_date: optDate(f, "start_date") ?? todayISO(TZ),
    due_date: due,
  });
  refresh();
}

export async function goalUpdate(f: FormData) {
  await requireAuth();
  const title = str(f, "title", 120);
  const due = optDate(f, "due_date");
  if (!title || !due) return;
  await db.updateGoal(id(f), { title, target: optNum(f, "target"), start_value: optNum(f, "start_value"), due_date: due });
  refresh();
}

export async function goalManual(f: FormData) {
  await requireAuth();
  const v = optNum(f, "value");
  if (v === null) return;
  await db.setGoalManual(id(f), v);
  refresh();
}

export async function goalDone(f: FormData) {
  await requireAuth();
  await db.setGoalDone(id(f), str(f, "done") === "true");
  refresh();
}

export async function goalDelete(f: FormData) {
  await requireAuth();
  await db.deleteGoal(id(f));
  refresh();
}
