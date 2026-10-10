import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/**
 * The key that signs webhook URLs and internal scheduler calls.
 *
 * VOICE_WEBHOOK_SECRET wins when set. Otherwise one is derived from the
 * Supabase secret key, so a fresh setup works without inventing another
 * secret — and it still never leaves the server.
 */
export function voiceSecret(): string {
  const explicit = process.env.VOICE_WEBHOOK_SECRET?.trim();
  if (explicit) return explicit;
  const base = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!base) throw new Error("Set VOICE_WEBHOOK_SECRET (or SUPABASE_SECRET_KEY) to sign voice webhooks.");
  return createHash("sha256").update(`eventease-voice:${base}`).digest("hex");
}

/** Short, URL-safe signature for `value`. */
export function sign(value: string): string {
  return createHmac("sha256", voiceSecret()).update(value).digest("base64url").slice(0, 32);
}

export function verify(value: string, signature: string | null | undefined): boolean {
  if (!signature) return false;
  const expected = Buffer.from(sign(value));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/** Bearer token for the reminder scheduler endpoint: CRON_SECRET (Vercel Cron) or a derived one. */
export function schedulerToken(): string {
  return process.env.CRON_SECRET?.trim() || sign("scheduler");
}
