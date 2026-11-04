// Calendar dates are handled as "YYYY-MM-DD" strings in the app's time zone,
// so "today" means today where Khushi is, not on the server.

export const TZ = process.env.APP_TIMEZONE || "America/New_York";

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isISODate(s: unknown): s is string {
  if (typeof s !== "string" || !ISO_RE.test(s)) return false;
  const d = parseISO(s);
  return !Number.isNaN(d.getTime()) && toISO(d) === s;
}

export function todayISO(tz: string = TZ, now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function parseISO(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function toISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(s: string, n: number): string {
  const d = parseISO(s);
  d.setUTCDate(d.getUTCDate() + n);
  return toISO(d);
}

/** 0 = Sunday … 6 = Saturday */
export function dayOfWeek(s: string): number {
  return parseISO(s).getUTCDay();
}

/** Weeks start on Monday. */
export function weekStart(s: string): string {
  return addDays(s, -((dayOfWeek(s) + 6) % 7));
}

export function daysBetween(from: string, to: string): number {
  return Math.round((parseISO(to).getTime() - parseISO(from).getTime()) / 86_400_000);
}

export function rangeDays(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

export type Quarter = { year: number; q: number; start: string; end: string; label: string };

export function quarterFor(s: string): Quarter {
  const d = parseISO(s);
  return quarter(d.getUTCFullYear(), Math.floor(d.getUTCMonth() / 3) + 1);
}

export function quarter(year: number, q: number): Quarter {
  const startMonth = (q - 1) * 3 + 1;
  const start = `${year}-${String(startMonth).padStart(2, "0")}-01`;
  const next = q === 4 ? `${year + 1}-01-01` : `${year}-${String(startMonth + 3).padStart(2, "0")}-01`;
  return { year, q, start, end: addDays(next, -1), label: `Q${q} ${year}` };
}

export function parseQuarterParam(p: string | undefined, fallback: string): Quarter {
  const m = /^(\d{4})-Q([1-4])$/.exec(p ?? "");
  return m ? quarter(Number(m[1]), Number(m[2])) : quarterFor(fallback);
}

export function shiftQuarter(qt: Quarter, n: number): Quarter {
  const idx = qt.year * 4 + (qt.q - 1) + n;
  return quarter(Math.floor(idx / 4), (idx % 4) + 1);
}

export function fmt(s: string, opts: Intl.DateTimeFormatOptions): string {
  return parseISO(s).toLocaleDateString("en-US", { timeZone: "UTC", ...opts });
}

export const fmtShort = (s: string) => fmt(s, { month: "short", day: "numeric" });
export const fmtLong = (s: string) => fmt(s, { weekday: "long", month: "long", day: "numeric" });
