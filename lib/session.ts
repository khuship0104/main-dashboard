import "server-only";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySession } from "./auth";

/** Server actions are reachable by POST from anywhere, so each one checks the session itself. */
export async function requireAuth() {
  if (!(await verifySession(cookies().get(SESSION_COOKIE)?.value))) {
    throw new Error("Your session has expired. Sign in again.");
  }
}
