import "server-only";

import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { AppError, isAppError } from "@/lib/errors";
import { isCallLanguage, type CallLanguage } from "@/lib/call-languages";
import { mediaUrl } from "@/lib/media";
import { normalizePhone } from "@/lib/phone";
import { uploadVoiceAudio, voiceAudioUrl } from "@/lib/storage";
import { fieldErrors, reminderSettingsSchema, type ReminderSettingsInput } from "@/lib/validation";
import { understandReply, writeReminderScript } from "@/lib/voice/agent";
import {
  requireCallingReady,
  resolvePublicBaseUrl,
  voiceEnv,
  voiceSetup,
  type VoiceSetupItem,
} from "@/lib/voice/config";
import { synthesize, speakerFor, transcribe } from "@/lib/voice/sarvam";
import { buildReminderScript, localDayKey, replyWindowSeconds, type ReplyIntent } from "@/lib/voice/script";
import { sign } from "@/lib/voice/secret";
import { downloadRecording, placeCall, reminderXml } from "@/lib/voice/vobiz";

/**
 * Aanaya's reminder calls.
 *
 *   enqueue → QUEUED rows, one per attendee with a phone number
 *   dispatchNext → claims the oldest QUEUED call, but only while no other call
 *                  for that event is live, so calls go out one by one
 *   webhooks → ring / answer (play + record) / hangup → the hang-up dials the next
 *   recording → Saaras transcribes the reply, the LLM reads it → CONFIRMED / DECLINED…
 *   scheduler → queues calls when an event's reminder time arrives, and
 *               un-sticks calls whose webhooks never came
 */

export const ACTIVE_STATUSES = ["DIALING", "RINGING", "IN_PROGRESS"] as const;
export const FINAL_STATUSES = ["COMPLETED", "NO_ANSWER", "BUSY", "FAILED", "CANCELED"] as const;
export type CallStatus = "QUEUED" | (typeof ACTIVE_STATUSES)[number] | (typeof FINAL_STATUSES)[number];

/** Bump to regenerate every cached prompt (e.g. after changing the script). */
const PROMPT_VERSION = "v1";
/** Longest message that still leaves room for a reply inside the 20-second call. */
const MAX_MESSAGE_MS = 15_000;
/** A live call with no webhook for this long is treated as lost. */
const STALE_CALL_MS = 3 * 60_000;

const isActive = (s: string) => (ACTIVE_STATUSES as readonly string[]).includes(s);
const isFinal = (s: string) => (FINAL_STATUSES as readonly string[]).includes(s);

/** Event setting first ("auto" defers to the attendee), then the attendee's choices, then Hindi. */
function resolveLanguage(
  eventSetting: string,
  override: CallLanguage | undefined,
  ...preferences: (string | null | undefined)[]
): CallLanguage {
  if (override) return override;
  if (isCallLanguage(eventSetting)) return eventSetting;
  return preferences.find(isCallLanguage) ?? "hi";
}

// ───────────────────────────── Console data ─────────────────────────────

export type CallRow = {
  registrationId: string;
  name: string;
  email: string;
  phone: string | null;
  language: CallLanguage;
  avatarUrl: string | null;
  checkedIn: boolean;
  attempts: number;
  lastCall: {
    id: string;
    status: CallStatus;
    intent: ReplyIntent | null;
    transcript: string | null;
    durationSec: number | null;
    language: string;
    trigger: string;
    error: string | null;
    at: string;
  } | null;
};

export type CallConsoleData = {
  event: {
    id: string;
    name: string;
    startsAt: string;
    theme: string;
    reminderEnabled: boolean;
    reminderLeadMinutes: number;
    reminderLanguage: string;
    reminderArriveEarly: number;
    reminderQueuedAt: string | null;
    /** When the scheduled reminder fires. */
    callAt: string;
  };
  rows: CallRow[];
  stats: {
    registrants: number;
    withPhone: number;
    queued: number;
    live: number;
    reached: number;
    unreachable: number;
    confirmed: number;
    declined: number;
  };
  setup: { canPreview: boolean; canCall: boolean; items: VoiceSetupItem[] };
  /** Server time of this snapshot, so the page renders without reading the clock. */
  now: string;
};

export async function getCallConsole(eventId: string): Promise<CallConsoleData | null> {
  const [event, registrations, setup] = await Promise.all([
    prisma.event.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        name: true,
        startsAt: true,
        theme: true,
        reminderEnabled: true,
        reminderLeadMinutes: true,
        reminderLanguage: true,
        reminderArriveEarly: true,
        reminderQueuedAt: true,
      },
    }),
    prisma.registration.findMany({
      where: { eventId },
      orderBy: [{ name: "asc" }, { id: "asc" }],
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        callLanguage: true,
        checkedInAt: true,
        user: { select: { phone: true, callLanguage: true, avatarPath: true } },
        reminderCalls: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            id: true,
            status: true,
            intent: true,
            transcript: true,
            durationSec: true,
            language: true,
            trigger: true,
            error: true,
            createdAt: true,
          },
        },
        _count: { select: { reminderCalls: true } },
      },
    }),
    voiceSetup(),
  ]);
  if (!event) return null;

  const rows: CallRow[] = registrations.map((r) => {
    const last = r.reminderCalls[0];
    return {
      registrationId: r.id,
      name: r.name,
      email: r.email,
      phone: normalizePhone(r.phone ?? r.user.phone),
      language: resolveLanguage(event.reminderLanguage, undefined, r.callLanguage, r.user.callLanguage),
      avatarUrl: mediaUrl(r.user.avatarPath),
      checkedIn: Boolean(r.checkedInAt),
      attempts: r._count.reminderCalls,
      lastCall: last
        ? {
            id: last.id,
            status: last.status as CallStatus,
            intent: (last.intent as ReplyIntent | null) ?? null,
            transcript: last.transcript,
            durationSec: last.durationSec,
            language: last.language,
            trigger: last.trigger,
            error: last.error,
            at: last.createdAt.toISOString(),
          }
        : null,
    };
  });

  const status = (r: CallRow) => r.lastCall?.status;
  return {
    event: {
      id: event.id,
      name: event.name,
      startsAt: event.startsAt.toISOString(),
      theme: event.theme,
      reminderEnabled: event.reminderEnabled,
      reminderLeadMinutes: event.reminderLeadMinutes,
      reminderLanguage: event.reminderLanguage,
      reminderArriveEarly: event.reminderArriveEarly,
      reminderQueuedAt: event.reminderQueuedAt?.toISOString() ?? null,
      callAt: new Date(event.startsAt.getTime() - event.reminderLeadMinutes * 60_000).toISOString(),
    },
    rows,
    stats: {
      registrants: rows.length,
      withPhone: rows.filter((r) => r.phone).length,
      queued: rows.filter((r) => status(r) === "QUEUED").length,
      live: rows.filter((r) => isActive(status(r) ?? "")).length,
      reached: rows.filter((r) => status(r) === "COMPLETED").length,
      unreachable: rows.filter((r) => ["NO_ANSWER", "BUSY", "FAILED"].includes(status(r) ?? "")).length,
      confirmed: rows.filter((r) => r.lastCall?.intent === "CONFIRMED").length,
      declined: rows.filter((r) => r.lastCall?.intent === "DECLINED").length,
    },
    setup,
    now: new Date().toISOString(),
  };
}

// ───────────────────────────── Settings ─────────────────────────────

export async function updateReminderSettings(eventId: string, input: ReminderSettingsInput) {
  const parsed = reminderSettingsSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError("VALIDATION_ERROR", "Please fix the highlighted fields.", fieldErrors(parsed.error));
  }
  const current = await prisma.event.findUnique({
    where: { id: eventId },
    select: { reminderEnabled: true, reminderLeadMinutes: true },
  });
  if (!current) throw new AppError("EVENT_NOT_FOUND", "This event doesn't exist.");
  const s = parsed.data;
  // Turning the reminder on, or moving it, arms it again. Anyone already
  // reached is skipped when it fires, so nobody is called twice.
  const rearm =
    s.reminderEnabled && (!current.reminderEnabled || current.reminderLeadMinutes !== s.reminderLeadMinutes);
  await prisma.event.update({ where: { id: eventId }, data: { ...s, ...(rearm ? { reminderQueuedAt: null } : {}) } });
}

// ───────────────────────────── Voice prompt ─────────────────────────────

export type PromptView = { id: string; script: string; audioUrl: string; durationMs: number; replySeconds: number };

const inflight = new Map<string, Promise<PromptView>>();

/**
 * The spoken reminder for this event in this language: written (LLM-polished
 * when available), voiced by Sarvam Bulbul v3, stored, and reused by every
 * call. Regenerated automatically when the event's name, time or "arrive
 * early" minutes change — or when "tomorrow" turns into "today".
 */
export async function ensurePrompt(eventId: string, language: CallLanguage): Promise<PromptView> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { name: true, startsAt: true, reminderArriveEarly: true },
  });
  if (!event) throw new AppError("EVENT_NOT_FOUND", "This event doesn't exist.");

  const now = new Date();
  const signature = createHash("sha256")
    .update(
      JSON.stringify([
        PROMPT_VERSION,
        event.name,
        event.startsAt.toISOString(),
        event.reminderArriveEarly,
        speakerFor(language),
        localDayKey(now),
        Boolean(voiceEnv().openaiKey),
      ]),
    )
    .digest("hex")
    .slice(0, 20);

  const key = `${eventId}:${language}:${signature}`;
  const pending = inflight.get(key);
  if (pending) return pending;

  const work = (async (): Promise<PromptView> => {
    const existing = await prisma.voicePrompt.findUnique({
      where: { eventId_language_signature: { eventId, language, signature } },
    });
    if (existing) return toPromptView(existing);

    const input = {
      eventName: event.name,
      startsAt: event.startsAt,
      arriveEarly: event.reminderArriveEarly,
      language,
      now,
    };
    let { script } = await writeReminderScript(input);
    let speech = await synthesize(script, language);
    if (speech.durationMs > MAX_MESSAGE_MS) {
      // Too long for a 20-second call: the plain template, spoken a little faster.
      script = buildReminderScript(input);
      speech = await synthesize(script, language, { pace: 1.3 });
    }

    const audioPath = `events/${eventId}/${language}-${signature}.wav`;
    await uploadVoiceAudio(audioPath, speech.audio, "audio/wav");
    const prompt = await prisma.voicePrompt.upsert({
      where: { eventId_language_signature: { eventId, language, signature } },
      create: { eventId, language, signature, script, audioPath, durationMs: speech.durationMs },
      update: {},
    });
    return toPromptView(prompt);
  })();

  inflight.set(key, work);
  try {
    return await work;
  } finally {
    inflight.delete(key);
  }
}

function toPromptView(p: { id: string; script: string; audioPath: string; durationMs: number }): PromptView {
  return {
    id: p.id,
    script: p.script,
    audioUrl: voiceAudioUrl(p.audioPath),
    durationMs: p.durationMs,
    replySeconds: replyWindowSeconds(p.durationMs),
  };
}

// ───────────────────────────── Queue ─────────────────────────────

export type EnqueueResult = { queued: number; noPhone: number; alreadyQueued: number; alreadyReached: number };

export async function enqueueCalls(
  eventId: string,
  opts: { registrationIds?: string[]; language?: CallLanguage; skipReached?: boolean; trigger: "MANUAL" | "SCHEDULED" },
): Promise<EnqueueResult> {
  await requireCallingReady();

  return prisma.$transaction(async (tx) => {
    // Serialise queueing for this event so a double click can't queue twice.
    const locked = await tx.$queryRaw<{ reminderLanguage: string }[]>`
      SELECT "reminderLanguage" FROM "Event" WHERE id = ${eventId} FOR UPDATE`;
    if (!locked[0]) throw new AppError("EVENT_NOT_FOUND", "This event doesn't exist.");

    const registrations = await tx.registration.findMany({
      where: { eventId, ...(opts.registrationIds ? { id: { in: opts.registrationIds } } : {}) },
      orderBy: [{ name: "asc" }, { id: "asc" }],
      select: {
        id: true,
        phone: true,
        callLanguage: true,
        user: { select: { phone: true, callLanguage: true } },
        reminderCalls: {
          where: { status: { in: ["QUEUED", ...ACTIVE_STATUSES, "COMPLETED"] } },
          select: { status: true },
        },
      },
    });

    const result: EnqueueResult = { queued: 0, noPhone: 0, alreadyQueued: 0, alreadyReached: 0 };
    const rows = [];
    for (const r of registrations) {
      const phone = normalizePhone(r.phone ?? r.user.phone);
      if (!phone) {
        result.noPhone++;
        continue;
      }
      if (r.reminderCalls.some((c) => c.status === "QUEUED" || isActive(c.status))) {
        result.alreadyQueued++;
        continue;
      }
      if ((opts.skipReached ?? true) && r.reminderCalls.some((c) => c.status === "COMPLETED")) {
        result.alreadyReached++;
        continue;
      }
      rows.push({
        eventId,
        registrationId: r.id,
        phone,
        language: resolveLanguage(locked[0].reminderLanguage, opts.language, r.callLanguage, r.user.callLanguage),
        trigger: opts.trigger,
      });
    }
    if (rows.length) await tx.reminderCall.createMany({ data: rows });
    result.queued = rows.length;
    return result;
  });
}

export async function cancelQueuedCalls(eventId: string): Promise<number> {
  const { count } = await prisma.reminderCall.updateMany({
    where: { eventId, status: "QUEUED" },
    data: { status: "CANCELED", endedAt: new Date() },
  });
  return count;
}

/** Takes the next queued call for this event, if no call for it is live. */
async function claimNext(eventId: string) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Event" WHERE id = ${eventId} FOR UPDATE`;
    const live = await tx.reminderCall.count({ where: { eventId, status: { in: [...ACTIVE_STATUSES] } } });
    if (live) return null;
    const next = await tx.reminderCall.findFirst({
      where: { eventId, status: "QUEUED" },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    if (!next) return null;
    return tx.reminderCall.update({ where: { id: next.id }, data: { status: "DIALING" } });
  });
}

/**
 * Dials the next person in this event's queue. Called after queueing, after
 * every hang-up, and by the scheduler. A call that can't be placed is marked
 * FAILED and the queue moves on.
 */
export async function dispatchNext(eventId: string): Promise<void> {
  let base: string;
  try {
    base = await requireCallingReady();
  } catch {
    return; // Not configured: leave the queue waiting.
  }

  for (let guard = 0; guard < 100; guard++) {
    const call = await claimNext(eventId);
    if (!call) return;
    try {
      const prompt = await ensurePrompt(eventId, call.language as CallLanguage);
      await prisma.reminderCall.update({ where: { id: call.id }, data: { promptId: prompt.id } });
      const q = callQuery(call.id);
      const { providerCallId } = await placeCall({
        to: call.phone,
        answerUrl: `${base}/api/voice/answer?${q}`,
        hangupUrl: `${base}/api/voice/hangup?${q}`,
        ringUrl: `${base}/api/voice/ring?${q}`,
      });
      await prisma.reminderCall.update({ where: { id: call.id }, data: { providerCallId } });
      return; // The hang-up webhook dials the next one.
    } catch (error) {
      if (!isAppError(error)) console.error("[reminders] couldn't start call", call.id, error);
      await prisma.reminderCall.update({
        where: { id: call.id },
        data: {
          status: "FAILED",
          error: isAppError(error) ? error.message : "Couldn't start the call.",
          endedAt: new Date(),
        },
      });
    }
  }
}

/** Signed query string identifying our call row in webhook URLs. */
export const callQuery = (callId: string) => new URLSearchParams({ id: callId, t: sign(callId) }).toString();

// ───────────────────────────── Webhooks ─────────────────────────────

export async function markRinging(callId: string) {
  await prisma.reminderCall.updateMany({ where: { id: callId, status: "DIALING" }, data: { status: "RINGING" } });
}

/** The person picked up: returns the XML that plays the reminder and records a short reply. */
export async function answerCall(callId: string): Promise<string> {
  const call = await prisma.reminderCall.findUnique({ where: { id: callId }, include: { prompt: true } });
  if (!call?.prompt || call.status === "CANCELED") return "<Hangup/>";
  await prisma.reminderCall.updateMany({
    where: { id: callId, status: { in: ["DIALING", "RINGING"] } },
    data: { status: "IN_PROGRESS", answeredAt: new Date() },
  });
  const base = (await resolvePublicBaseUrl()) ?? "";
  const q = callQuery(callId);
  return reminderXml({
    audioUrl: voiceAudioUrl(call.prompt.audioPath),
    replySeconds: replyWindowSeconds(call.prompt.durationMs),
    recordActionUrl: `${base}/api/voice/recording?${q}&stage=action`,
    recordCallbackUrl: `${base}/api/voice/recording?${q}`,
  });
}

/**
 * The call ended. Works out how (reached, no answer, busy, failed) and returns
 * the event id so the caller can dial the next person. Idempotent: Vobiz
 * retries webhooks, and a repeat changes nothing.
 */
export async function finishCall(
  callId: string,
  p: { callStatus: string; hangupCause: string; duration: string; answerTime: string },
): Promise<string | null> {
  const call = await prisma.reminderCall.findUnique({
    where: { id: callId },
    select: { status: true, answeredAt: true, eventId: true },
  });
  if (!call) return null;
  if (isFinal(call.status)) return call.eventId;

  const cs = p.callStatus.toLowerCase();
  const cause = p.hangupCause.toLowerCase();
  const duration = Number.parseInt(p.duration, 10);
  // AnswerTime is "yyyy-MM-dd HH:mm:ss" when the call connected, empty otherwise.
  const answered = Boolean(call.answeredAt) || /^[1-9]\d{3}-/.test(p.answerTime.trim());

  let status: CallStatus;
  if (answered) status = "COMPLETED";
  else if (cs === "busy" || /busy|reject|3010|3020/.test(cause)) status = "BUSY";
  else if (["no-answer", "timeout", "cancel", "completed"].includes(cs) || /no.?answer|timeout|3000|6010/.test(cause))
    status = "NO_ANSWER";
  else status = "FAILED";

  await prisma.reminderCall.updateMany({
    where: { id: callId, status: { notIn: [...FINAL_STATUSES] } },
    data: {
      status,
      durationSec: Number.isFinite(duration) ? duration : null,
      hangupCause: p.hangupCause || null,
      endedAt: new Date(),
      ...(status === "FAILED"
        ? { error: `The call didn't connect (${p.hangupCause || cs || "unknown reason"}).` }
        : {}),
    },
  });
  return call.eventId;
}

/** The reply recording is ready: transcribe it (Saaras v3) and work out what it means. */
export async function processReply(callId: string, p: { recordUrl: string; durationMs: number }) {
  const call = await prisma.reminderCall.findUnique({
    where: { id: callId },
    select: { language: true, intent: true },
  });
  if (!call || call.intent) return;
  const language = isCallLanguage(call.language) ? call.language : "hi";

  if (!p.recordUrl || p.durationMs < 400) {
    await prisma.reminderCall.update({ where: { id: callId }, data: { intent: "NO_RESPONSE" } });
    return;
  }
  try {
    const audio = await downloadRecording(p.recordUrl);
    const { transcript } = await transcribe(audio, language);
    const intent = await understandReply(transcript, language);
    await prisma.reminderCall.update({ where: { id: callId }, data: { transcript: transcript || null, intent } });
  } catch (error) {
    console.error("[reminders] couldn't process the reply for", callId, error);
  }
}

// ───────────────────────────── Scheduler ─────────────────────────────

export type SchedulerResult = {
  recovered: number;
  eventsDue: number;
  queued: number;
  dispatched: number;
  note?: string;
};

/**
 * One scheduler pass. Runs every 30 s in development (src/instrumentation.ts)
 * and from a cron hitting /api/cron/reminders in production. Safe to run
 * concurrently: every step claims its work atomically.
 */
export async function runReminderScheduler(): Promise<SchedulerResult> {
  const result: SchedulerResult = { recovered: 0, eventsDue: 0, queued: 0, dispatched: 0 };

  // 1. Calls whose webhooks never arrived would block their event's queue forever.
  const stale = await prisma.reminderCall.updateMany({
    where: { status: { in: [...ACTIVE_STATUSES] }, updatedAt: { lt: new Date(Date.now() - STALE_CALL_MS) } },
    data: { status: "FAILED", error: "No status from the phone network — marked as failed.", endedAt: new Date() },
  });
  result.recovered = stale.count;

  const setup = await voiceSetup();
  if (!setup.canCall) {
    result.note = "Reminder calls aren't configured yet.";
    return result;
  }

  // 2. Events whose reminder time has come. Claiming sets reminderQueuedAt, so
  //    two scheduler instances can never queue the same event twice.
  const due = await prisma.$queryRaw<{ id: string }[]>`
    UPDATE "Event" SET "reminderQueuedAt" = (now() AT TIME ZONE 'UTC')
    WHERE "reminderEnabled" = true
      AND "reminderQueuedAt" IS NULL
      AND "startsAt" > (now() AT TIME ZONE 'UTC')
      AND "startsAt" - make_interval(mins => "reminderLeadMinutes") <= (now() AT TIME ZONE 'UTC')
    RETURNING id`;
  result.eventsDue = due.length;
  for (const { id } of due) {
    try {
      const r = await enqueueCalls(id, { trigger: "SCHEDULED", skipReached: true });
      result.queued += r.queued;
    } catch (error) {
      console.error("[reminders] couldn't queue scheduled calls for", id, error);
    }
  }

  // 3. Any event with people waiting and nobody on the line: dial the next one.
  const waiting = await prisma.$queryRaw<{ eventId: string }[]>`
    SELECT DISTINCT q."eventId" FROM "ReminderCall" q
    WHERE q.status = 'QUEUED'
      AND NOT EXISTS (
        SELECT 1 FROM "ReminderCall" a
        WHERE a."eventId" = q."eventId" AND a.status IN ('DIALING', 'RINGING', 'IN_PROGRESS')
      )`;
  for (const { eventId } of waiting) {
    await dispatchNext(eventId);
    result.dispatched++;
  }
  return result;
}
