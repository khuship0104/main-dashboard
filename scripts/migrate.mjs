// Applies db/schema.sql (idempotent) and seeds starting data once.
// Runs automatically before `next build` on Vercel. Skips quietly when DATABASE_URL is unset.
import { readFile } from "node:fs/promises";
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!url) {
  console.log("[migrate] DATABASE_URL not set, skipping database setup.");
  process.exit(0);
}

const sql = neon(url);

function statements(text) {
  return text
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
}

async function run(file) {
  const text = await readFile(new URL(`../db/${file}`, import.meta.url), "utf8");
  for (const stmt of statements(text)) await sql.query(stmt);
}

await run("schema.sql");
const seeded = await sql.query("select 1 from settings where key = 'seeded'");
if (seeded.length === 0) {
  await run("seed.sql");
  console.log("[migrate] Schema applied and starting data added.");
} else {
  console.log("[migrate] Schema up to date.");
}
