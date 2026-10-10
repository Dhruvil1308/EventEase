import { connection, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { apiError, handleApiError } from "@/lib/api";
import { runReminderScheduler } from "@/lib/services/reminders";
import { schedulerToken } from "@/lib/voice/secret";

export const maxDuration = 60;

function authorized(request: Request) {
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${schedulerToken()}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * GET /api/cron/reminders — one pass of the reminder scheduler: queues calls
 * for events whose reminder time has arrived and keeps every queue moving.
 *
 * Locally the app runs this itself every 30 s (src/instrumentation.ts). In
 * production, point a cron at it every minute with `Authorization: Bearer
 * $CRON_SECRET` (Vercel Cron sends that header automatically).
 */
export async function GET(request: Request) {
  await connection();
  if (!authorized(request)) return apiError(401, "UNAUTHORIZED", "Missing or wrong scheduler token.");
  try {
    return NextResponse.json(await runReminderScheduler());
  } catch (error) {
    return handleApiError(error);
  }
}
