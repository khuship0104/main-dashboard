# Life dashboard

Khushi's personal dashboard: daily habits, water, weigh-ins, workouts, to-dos, a job application pipeline, and weekly and quarterly views of goal progress.

Built with Next.js 14 (App Router, server actions), Neon Postgres, and no client-side data fetching. Charts are plain SVG.

## Pages

| Page | What it's for |
| --- | --- |
| **Today** | Check off habits, tap in glasses of water, log a weigh-in, quick-log a workout or an application, see to-dos and follow-ups due. Use the date button to fix a past day. |
| **Week** | Habit grid for the week, water by day, workouts, applications vs. your weekly target, weight change, goal progress. |
| **Quarter** | Goals due this quarter, plus weekly charts for weight, applications, habit score and workouts. |
| **Job search** | Pipeline board (saved → applied → screen → interview → offer), follow-up dates, notes, response rate. |
| **To-dos** | One-off tasks grouped by overdue, today, this week, later and undated. |
| **Workouts** | Log type, minutes and notes. Logging a workout checks off the workout habit. |
| **Settings** | Water and weekly application targets, habits (add, edit, reorder, archive), goals (add, edit, mark achieved). |

## Deploy on Vercel with Neon

1. **Import the repo.** In Vercel, choose *Add New → Project* and import this GitHub repository. Keep the default Next.js settings, but don't deploy yet.
2. **Add the database.** In the project, open *Storage → Create Database → Neon*, create it, and connect it to the project. This adds `DATABASE_URL` automatically.
3. **Add two environment variables** under *Settings → Environment Variables*:
   - `APP_PASSWORD`: the password you'll type to sign in. Use a long passphrase.
   - `SUMMARY_TOKEN`: a random string of at least 24 characters for the reminder endpoint. Run `openssl rand -hex 24` in a terminal, or use any password generator.
   - Optional: `APP_TIMEZONE`, which defaults to `America/New_York`.
4. **Deploy.** The build runs `scripts/migrate.mjs` first. It creates the tables and adds your starting habits and goals once. Later deploys leave your data alone.
5. **Sign in** at your `*.vercel.app` URL with `APP_PASSWORD`. On your phone, use *Add to Home Screen* so it opens like an app.

### Local development

```bash
cp .env.example .env.local   # fill in DATABASE_URL from Neon, plus APP_PASSWORD and SUMMARY_TOKEN
npm install
npm run db:migrate
npm run dev
```

## Reminder endpoint

`GET /api/summary/<SUMMARY_TOKEN>` returns a read-only JSON snapshot. The scheduled morning brief, water reminders and weigh-in reminder read it. It includes today's water and habit status, whether a weigh-in is due, this week's numbers, to-dos due, follow-ups due, pipeline counts and goal progress. It doesn't include notes.

Anyone with the full URL can read that snapshot, so treat it like a password. To revoke access, change `SUMMARY_TOKEN` in Vercel and redeploy.

## How progress is measured

- **Daily score**: habits checked plus the water goal met, out of active habits + 1.
- **Weight goal**: from the starting weight to the target. If a goal is set as "lose 20 lb", your first weigh-in becomes the starting weight. The bar's marker shows where a steady pace would put you today.
- **Job goal**: the furthest stage any open application has reached (applied, screen, interview, offer).
- **Applications / workouts goals**: counts between the goal's start and due dates.
- **Manual goals**: a number you update in Settings.

Weeks start on Monday. Dates follow `APP_TIMEZONE`, so "today" matches your clock, not the server's.

## Security

- Every page and server action checks a signed, HTTP-only session cookie (30 days). Signing in uses `APP_PASSWORD`. Changing the password signs out every device.
- Pages send `noindex` and deny framing.
- Keep the Next.js version at 14.2.25 or newer; `package.json` already requires it.
