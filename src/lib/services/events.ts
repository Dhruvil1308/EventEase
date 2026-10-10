import { Prisma } from "@/generated/prisma/client";
import { prisma, readWithRetry } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { parsePrizes, type Prize } from "@/lib/event-types";
import { mediaUrl } from "@/lib/media";
import { createEventSchema, fieldErrors, type CreateEventInput } from "@/lib/validation";

export type EventStats = {
  capacity: number;
  registered: number;
  checkedIn: number;
  remaining: number;
  /** registrations / capacity, 0–1 */
  fillRate: number;
  /** checked-in / registered, 0–1 */
  attendanceRate: number;
};

export type EventSummary = {
  id: string;
  name: string;
  description: string;
  venue: string;
  startsAt: string;
  /** Null for events created before end times existed. */
  endsAt: string | null;
  type: string;
  /** Whole rupees, 0 = free. */
  entryFee: number;
  prizes: Prize[];
  coverUrl: string | null;
  theme: string;
  createdAt: string;
  /** The host account that owns this event. */
  hostId: string;
  hostName: string;
  stats: EventStats;
};

type EventRow = {
  id: string;
  name: string;
  description: string;
  venue: string;
  startsAt: Date;
  endsAt: Date | null;
  type: string;
  entryFee: number;
  prizes: unknown;
  coverPath: string | null;
  capacity: number;
  theme: string;
  createdAt: Date;
  hostId: string;
  host?: { name: string } | null;
};

export function buildStats(capacity: number, registered: number, checkedIn: number): EventStats {
  return {
    capacity,
    registered,
    checkedIn,
    remaining: Math.max(capacity - registered, 0),
    fillRate: capacity > 0 ? Math.min(registered / capacity, 1) : 0,
    attendanceRate: registered > 0 ? checkedIn / registered : 0,
  };
}

function toSummary(event: EventRow, registered: number, checkedIn: number): EventSummary {
  return {
    id: event.id,
    name: event.name,
    description: event.description,
    venue: event.venue,
    startsAt: event.startsAt.toISOString(),
    endsAt: event.endsAt?.toISOString() ?? null,
    type: event.type,
    entryFee: event.entryFee,
    prizes: parsePrizes(event.prizes),
    coverUrl: mediaUrl(event.coverPath),
    theme: event.theme,
    createdAt: event.createdAt.toISOString(),
    hostId: event.hostId,
    hostName: event.host?.name ?? "EventEase host",
    stats: buildStats(event.capacity, registered, checkedIn),
  };
}

/**
 * One row per event, with its host's name and both counts already aggregated.
 *
 * Prisma's `include` issues a second query for the relation and `groupBy` a
 * third, which costs three sequential round trips. The database is remote, so
 * each one is real latency — a single join answers the whole thing in one.
 */
type SummaryRow = Omit<EventRow, "host"> & { hostName: string; registered: number; checkedIn: number };

const rowToSummary = (r: SummaryRow): EventSummary =>
  toSummary({ ...r, host: { name: r.hostName } }, r.registered, r.checkedIn);

/** The columns every summary query selects. `counts` must expose registered/checkedIn per event as `c`. */
const SUMMARY_COLUMNS = Prisma.sql`
  e.id, e.name, e.description, e.venue, e."startsAt", e."endsAt", e.type, e."entryFee", e.prizes,
  e."coverPath", e.capacity, e.theme, e."createdAt", e."hostId", p.name AS "hostName",
  COALESCE(c.registered, 0)::int AS registered,
  COALESCE(c."checkedIn", 0)::int AS "checkedIn"`;

export async function listEvents(): Promise<EventSummary[]> {
  const rows = await readWithRetry(
    () => prisma.$queryRaw<SummaryRow[]>`
    SELECT ${SUMMARY_COLUMNS}
    FROM "Event" e
    JOIN "Profile" p ON p.id = e."hostId"
    LEFT JOIN (
      SELECT "eventId", COUNT(*)::int AS registered, COUNT("checkedInAt")::int AS "checkedIn"
      FROM "Registration" GROUP BY "eventId"
    ) c ON c."eventId" = e.id
    ORDER BY e."startsAt" ASC`,
  );
  return rows.map(rowToSummary);
}

export async function getEventSummary(id: string): Promise<EventSummary | null> {
  const rows = await prisma.$queryRaw<SummaryRow[]>`
    SELECT ${SUMMARY_COLUMNS}
    FROM "Event" e
    JOIN "Profile" p ON p.id = e."hostId"
    LEFT JOIN (
      SELECT "eventId", COUNT(*)::int AS registered, COUNT("checkedInAt")::int AS "checkedIn"
      FROM "Registration" WHERE "eventId" = ${id} GROUP BY "eventId"
    ) c ON c."eventId" = e.id
    WHERE e.id = ${id}`;
  return rows[0] ? rowToSummary(rows[0]) : null;
}

export async function getEventCounts(eventId: string) {
  // One scan instead of two queries: `COUNT(col)` skips NULLs.
  const [row] = await prisma.$queryRaw<{ registered: number; checkedIn: number }[]>`
    SELECT COUNT(*)::int AS registered, COUNT("checkedInAt")::int AS "checkedIn"
    FROM "Registration" WHERE "eventId" = ${eventId}`;
  return { registered: row?.registered ?? 0, checkedIn: row?.checkedIn ?? 0 };
}

export async function getEventStats(eventId: string): Promise<EventStats | null> {
  const event = await prisma.event.findUnique({ where: { id: eventId }, select: { capacity: true } });
  if (!event) return null;
  const { registered, checkedIn } = await getEventCounts(eventId);
  return buildStats(event.capacity, registered, checkedIn);
}

function parseEventInput(input: CreateEventInput) {
  const parsed = createEventSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError("VALIDATION_ERROR", "Please fix the highlighted fields.", fieldErrors(parsed.error));
  }
  return parsed.data;
}

export async function createEvent(input: CreateEventInput, hostId: string) {
  const data = parseEventInput(input);
  const event = await prisma.event.create({
    data: { ...data, hostId },
    include: { host: { select: { name: true } } },
  });
  return toSummary(event, 0, 0);
}

/** Everything the edit form needs, including the host-only reminder settings. Owner only. */
export async function getEventForEdit(id: string, hostId: string) {
  const event = await prisma.event.findFirst({ where: { id, hostId } });
  if (!event) return null;
  return {
    id: event.id,
    name: event.name,
    description: event.description,
    venue: event.venue,
    startsAt: event.startsAt.toISOString(),
    endsAt: event.endsAt?.toISOString() ?? null,
    capacity: event.capacity,
    theme: event.theme,
    type: event.type,
    entryFee: event.entryFee,
    prizes: parsePrizes(event.prizes),
    coverUrl: mediaUrl(event.coverPath),
    reminderEnabled: event.reminderEnabled,
    reminderLeadMinutes: event.reminderLeadMinutes,
    reminderLanguage: event.reminderLanguage,
    reminderArriveEarly: event.reminderArriveEarly,
  };
}

export type EditableEvent = NonNullable<Awaited<ReturnType<typeof getEventForEdit>>>;

/**
 * Updates an event the host owns. Capacity can't drop below the tickets
 * already issued, and moving the start time re-arms the scheduled reminder.
 */
export async function updateEvent(id: string, hostId: string, input: CreateEventInput) {
  const data = parseEventInput(input);
  const existing = await prisma.event.findFirst({
    where: { id, hostId },
    select: { startsAt: true, reminderLeadMinutes: true },
  });
  if (!existing) throw new AppError("EVENT_NOT_FOUND", "This event no longer exists, or it isn't yours to edit.");

  const { registered, checkedIn } = await getEventCounts(id);
  if (data.capacity < registered) {
    const message = `${registered} people already hold tickets — capacity can't go below that.`;
    throw new AppError("VALIDATION_ERROR", message, { capacity: [message] });
  }

  const rescheduled =
    existing.startsAt.getTime() !== data.startsAt.getTime() ||
    existing.reminderLeadMinutes !== data.reminderLeadMinutes;
  const event = await prisma.event.update({
    where: { id },
    data: { ...data, ...(rescheduled ? { reminderQueuedAt: null } : {}) },
    include: { host: { select: { name: true } } },
  });
  return toSummary(event, registered, checkedIn);
}

/**
 * Deleting is scoped to the owner, so a host can never remove someone else's
 * event. Returns the banner's storage path so the caller can clean it up.
 */
export async function deleteEvent(id: string, hostId: string): Promise<{ coverPath: string | null }> {
  const event = await prisma.event.findFirst({ where: { id, hostId }, select: { coverPath: true } });
  const result = await prisma.event.deleteMany({ where: { id, hostId } });
  if (result.count === 0) {
    throw new AppError("EVENT_NOT_FOUND", "This event no longer exists, or it isn't yours to delete.");
  }
  return { coverPath: event?.coverPath ?? null };
}

/** Every event this host owns — same single-join shape as `listEvents`. */
export async function listEventsForHost(hostId: string): Promise<EventSummary[]> {
  const rows = await prisma.$queryRaw<SummaryRow[]>`
    SELECT ${SUMMARY_COLUMNS}
    FROM "Event" e
    JOIN "Profile" p ON p.id = e."hostId"
    LEFT JOIN (
      SELECT "eventId", COUNT(*)::int AS registered, COUNT("checkedInAt")::int AS "checkedIn"
      FROM "Registration" GROUP BY "eventId"
    ) c ON c."eventId" = e.id
    WHERE e."hostId" = ${hostId}::uuid
    ORDER BY e."startsAt" ASC`;
  return rows.map(rowToSummary);
}

/** Totals across everything this host runs, for the host dashboard header. */
export async function getHostStats(hostId: string): Promise<GlobalStats & { reminderCalls: number }> {
  // One round trip (and one pooled connection) instead of six.
  const [row] = await readWithRetry(
    () => prisma.$queryRaw<(GlobalStats & { reminderCalls: number })[]>`
    WITH mine AS (SELECT id, capacity FROM "Event" WHERE "hostId" = ${hostId}::uuid)
    SELECT
      (SELECT COUNT(*)::int FROM mine) AS events,
      (SELECT COALESCE(SUM(capacity), 0)::int FROM mine) AS "totalCapacity",
      (SELECT COUNT(*)::int FROM "Registration" WHERE "eventId" IN (SELECT id FROM mine)) AS registrations,
      (SELECT COUNT("checkedInAt")::int FROM "Registration" WHERE "eventId" IN (SELECT id FROM mine)) AS "checkIns",
      (SELECT COUNT(*)::int FROM "CheckInLog"
        WHERE result = 'DUPLICATE' AND "eventId" IN (SELECT id FROM mine)) AS "duplicatesBlocked",
      (SELECT COUNT(*)::int FROM "ReminderCall"
        WHERE status = 'COMPLETED' AND "eventId" IN (SELECT id FROM mine)) AS "reminderCalls"`,
  );
  return row;
}

export type GlobalStats = {
  events: number;
  registrations: number;
  checkIns: number;
  duplicatesBlocked: number;
  totalCapacity: number;
};

export async function getGlobalStats(): Promise<GlobalStats> {
  // One round trip (and one pooled connection) instead of five.
  const [row] = await readWithRetry(
    () => prisma.$queryRaw<GlobalStats[]>`
    SELECT
      (SELECT COUNT(*)::int FROM "Event") AS events,
      (SELECT COALESCE(SUM(capacity), 0)::int FROM "Event") AS "totalCapacity",
      (SELECT COUNT(*)::int FROM "Registration") AS registrations,
      (SELECT COUNT("checkedInAt")::int FROM "Registration") AS "checkIns",
      (SELECT COUNT(*)::int FROM "CheckInLog" WHERE result = 'DUPLICATE') AS "duplicatesBlocked"`,
  );
  return row;
}
