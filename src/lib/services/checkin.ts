import { prisma } from "@/lib/prisma";
import { normalizeEntryCode } from "@/lib/codes";
import { buildStats, getEventCounts, type EventStats } from "./events";

export type CheckInStatus = "SUCCESS" | "DUPLICATE" | "INVALID" | "WRONG_EVENT";

export type CheckInParticipant = {
  name: string;
  email: string;
  code: string;
  studentId: string | null;
  department: string | null;
};

export type CheckInEvent = { id: string; name: string; venue: string; theme: string };

export type CheckInResult =
  | {
      status: "SUCCESS";
      message: string;
      code: string;
      checkedInAt: string;
      participant: CheckInParticipant;
      event: CheckInEvent;
      stats: EventStats;
    }
  | {
      status: "DUPLICATE";
      message: string;
      code: string;
      /** When the ticket was originally used */
      checkedInAt: string;
      participant: CheckInParticipant;
      event: CheckInEvent;
      stats: EventStats;
    }
  | {
      status: "WRONG_EVENT";
      message: string;
      code: string;
      participant: CheckInParticipant;
      event: CheckInEvent;
    }
  | { status: "INVALID"; message: string; code: string };

/**
 * Verifies an entry code and checks the participant in exactly once.
 *
 * The check-in itself is a single conditional UPDATE
 * (`... WHERE id = ? AND checkedInAt IS NULL`), so even if the same QR is
 * scanned at two gates in the same millisecond only one scan can win — the
 * other gets DUPLICATE. Every attempt is written to the audit log.
 */
export async function checkIn(rawCode: string, gateEventId?: string): Promise<CheckInResult> {
  const code = normalizeEntryCode(rawCode);
  const displayCode = code ?? rawCode.trim().slice(0, 40);

  const registration = code
    ? await prisma.registration.findUnique({ where: { code }, include: { event: true } })
    : null;

  if (!registration) {
    await prisma.checkInLog.create({
      data: { result: "INVALID", code: displayCode, eventId: await existingEventId(gateEventId) },
    });
    return {
      status: "INVALID",
      code: displayCode,
      message: code ? "No ticket matches this code." : "That doesn't look like an EventEase entry code.",
    };
  }

  const participant: CheckInParticipant = {
    name: registration.name,
    email: registration.email,
    code: registration.code,
    studentId: registration.studentId,
    department: registration.department,
  };
  const event: CheckInEvent = {
    id: registration.event.id,
    name: registration.event.name,
    venue: registration.event.venue,
    theme: registration.event.theme,
  };

  if (gateEventId && gateEventId !== registration.eventId) {
    await prisma.checkInLog.create({
      data: {
        result: "WRONG_EVENT",
        code: registration.code,
        eventId: await existingEventId(gateEventId),
        registrationId: registration.id,
      },
    });
    return {
      status: "WRONG_EVENT",
      code: registration.code,
      participant,
      event,
      message: `This ticket is for “${registration.event.name}”, not this gate's event.`,
    };
  }

  const now = new Date();
  const claimed = await prisma.registration.updateMany({
    where: { id: registration.id, checkedInAt: null },
    data: { checkedInAt: now },
  });
  const success = claimed.count === 1;

  await prisma.checkInLog.create({
    data: {
      result: success ? "SUCCESS" : "DUPLICATE",
      code: registration.code,
      eventId: registration.eventId,
      registrationId: registration.id,
    },
  });

  const counts = await getEventCounts(registration.eventId);
  const stats = buildStats(registration.event.capacity, counts.registered, counts.checkedIn);

  if (success) {
    return {
      status: "SUCCESS",
      code: registration.code,
      checkedInAt: now.toISOString(),
      participant,
      event,
      stats,
      message: `Welcome, ${registration.name.split(" ")[0]}! Entry granted.`,
    };
  }

  // Lost the race or already used: read the original check-in time.
  const original = await prisma.registration.findUnique({
    where: { id: registration.id },
    select: { checkedInAt: true },
  });
  return {
    status: "DUPLICATE",
    code: registration.code,
    checkedInAt: (original?.checkedInAt ?? now).toISOString(),
    participant,
    event,
    stats,
    message: "This ticket has already been used. Entry denied.",
  };
}

/** Only link logs to events that still exist (the gate may hold a stale id). */
async function existingEventId(eventId?: string) {
  if (!eventId) return undefined;
  const event = await prisma.event.findUnique({ where: { id: eventId }, select: { id: true } });
  return event?.id;
}

export type ActivityItem = {
  id: string;
  result: CheckInStatus;
  code: string;
  name: string | null;
  eventName: string | null;
  createdAt: string;
};

export async function recentActivity(eventId?: string, take = 12): Promise<ActivityItem[]> {
  const logs = await prisma.checkInLog.findMany({
    where: eventId ? { eventId } : undefined,
    orderBy: { createdAt: "desc" },
    take,
    include: {
      registration: { select: { name: true } },
      event: { select: { name: true } },
    },
  });
  return logs.map((l) => ({
    id: l.id,
    result: l.result as CheckInStatus,
    code: l.code,
    name: l.registration?.name ?? null,
    eventName: l.event?.name ?? null,
    createdAt: l.createdAt.toISOString(),
  }));
}

export type GateCounts = Record<CheckInStatus, number>;

/** How many scans at this event's gate ended in each result. */
export async function gateCounts(eventId: string): Promise<GateCounts> {
  const rows = await prisma.checkInLog.groupBy({
    by: ["result"],
    where: { eventId },
    _count: { _all: true },
  });
  const counts: GateCounts = { SUCCESS: 0, DUPLICATE: 0, INVALID: 0, WRONG_EVENT: 0 };
  for (const row of rows) counts[row.result as CheckInStatus] = row._count._all;
  return counts;
}
