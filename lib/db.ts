import { neon } from "@neondatabase/serverless";

type Client = ReturnType<typeof neon>;
let client: Client | null = null;

function sql(): Client {
  if (!client) {
    const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
    if (!url) throw new Error("DATABASE_URL is not set. Add the Neon integration in Vercel.");
    client = neon(url);
  }
  return client;
}

/**
 * Run one parameterized query and return its rows.
 * Select dates as ::text and counts as ::int so values arrive as plain strings and numbers.
 */
export async function q<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> {
  const rows = await sql().query(text, params);
  return rows as unknown as T[];
}
