/**
 * Runs once when the server starts. Outside Vercel it drives the reminder-call
 * scheduler: every 30 seconds it pokes /api/cron/reminders, which queues calls
 * for events whose reminder time has arrived and keeps the call queues moving.
 *
 * On Vercel (serverless, no long-lived process) a cron hits that route instead.
 * Set REMINDER_SCHEDULER=off to disable the in-process timer.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.VERCEL || process.env.REMINDER_SCHEDULER === "off") return;

  const { schedulerToken } = await import("./lib/voice/secret");
  const globalForScheduler = globalThis as unknown as { __eventeaseScheduler?: ReturnType<typeof setInterval> };
  if (globalForScheduler.__eventeaseScheduler) return;

  const port = process.env.PORT ?? "3000";
  const tick = async () => {
    try {
      await fetch(`http://127.0.0.1:${port}/api/cron/reminders`, {
        headers: { Authorization: `Bearer ${schedulerToken()}` },
        cache: "no-store",
        signal: AbortSignal.timeout(55_000),
      });
    } catch {
      // Server still starting, or briefly unavailable — the next tick retries.
    }
  };
  globalForScheduler.__eventeaseScheduler = setInterval(tick, 30_000);
  setTimeout(tick, 15_000);
}
