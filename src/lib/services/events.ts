import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
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
type SummaryRow = {
  id: string;
  name: string;
  description: string;
  venue: string;
  startsAt: Date;
  capacity: number;
  theme: string;
  createdAt: Date;
  hostId: string;
  hostName: string;
  registered: number;
  checkedIn: number;
};

const rowToSummary = (r: SummaryRow): EventSummary =>
  toSummary({ ...r, host: { name: r.hostName } }, r.registered, r.checkedIn);

export async function listEvents(): Promise<EventSummary[]> {
  const rows = await prisma.$queryRaw<SummaryRow[]>`
    SELECT e.id, e.name, e.description, e.venue, e."startsAt", e.capacity, e.theme,
           e."createdAt", e."hostId", p.name AS "hostName",
           COALESCE(c.registered, 0)::int AS registered,
           COALESCE(c."checkedIn", 0)::int AS "checkedIn"
    FROM "Event" e
    JOIN "Profile" p ON p.id = e."hostId"
    LEFT JOIN (
      SELECT "eventId", COUNT(*)::int AS registered, COUNT("checkedInAt")::int AS "checkedIn"
      FROM "Registration" GROUP BY "eventId"
    ) c ON c."eventId" = e.id
    ORDER BY e."startsAt" ASC`;
  return rows.map(rowToSummary);
}

export async function getEventSummary(id: string): Promise<EventSummary | null> {
  const rows = await prisma.$queryRaw<SummaryRow[]>`
    SELECT e.id, e.name, e.description, e.venue, e."startsAt", e.capacity, e.theme,
           e."createdAt", e."hostId", p.name AS "hostName",
           COALESCE(c.registered, 0)::int AS registered,
           COALESCE(c."checkedIn", 0)::int AS "checkedIn"
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

export async function createEvent(input: CreateEventInput, hostId: string) {
  const parsed = createEventSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError("VALIDATION_ERROR", "Please fix the highlighted fields.", fieldErrors(parsed.error));
  }
  const event = await prisma.event.create({
    data: { ...parsed.data, hostId },
    include: { host: { select: { name: true } } },
  });
  return toSummary(event, 0, 0);
}

/** Deleting is scoped to the owner, so a host can never remove someone else's event. */
export async function deleteEvent(id: string, hostId: string) {
  const result = await prisma.event.deleteMany({ where: { id, hostId } });
  if (result.count === 0) {
    throw new AppError("EVENT_NOT_FOUND", "This event no longer exists, or it isn't yours to delete.");
  }
}

/** Every event this host owns — same single-join shape as `listEvents`. */
export async function listEventsForHost(hostId: string): Promise<EventSummary[]> {
  const rows = await prisma.$queryRaw<SummaryRow[]>`
    SELECT e.id, e.name, e.description, e.venue, e."startsAt", e.capacity, e.theme,
           e."createdAt", e."hostId", p.name AS "hostName",
           COALESCE(c.registered, 0)::int AS registered,
           COALESCE(c."checkedIn", 0)::int AS "checkedIn"
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
export async function getHostStats(hostId: string): Promise<GlobalStats> {
  const [events, capacity, registrations, checkIns, duplicatesBlocked] = await Promise.all([
    prisma.event.count({ where: { hostId } }),
    prisma.event.aggregate({ where: { hostId }, _sum: { capacity: true } }),
    prisma.registration.count({ where: { event: { hostId } } }),
    prisma.registration.count({ where: { event: { hostId }, checkedInAt: { not: null } } }),
    prisma.checkInLog.count({ where: { result: "DUPLICATE", event: { hostId } } }),
  ]);
  return { events, registrations, checkIns, duplicatesBlocked, totalCapacity: capacity._sum.capacity ?? 0 };
}

export type GlobalStats = {
  events: number;
  registrations: number;
  checkIns: number;
  duplicatesBlocked: number;
  totalCapacity: number;
};

export async function getGlobalStats(): Promise<GlobalStats> {
  const [events, capacity, registrations, checkIns, duplicatesBlocked] = await Promise.all([
    prisma.event.count(),
    prisma.event.aggregate({ _sum: { capacity: true } }),
    prisma.registration.count(),
    prisma.registration.count({ where: { checkedInAt: { not: null } } }),
    prisma.checkInLog.count({ where: { result: "DUPLICATE" } }),
  ]);
  return {
    events,
    registrations,
    checkIns,
    duplicatesBlocked,
    totalCapacity: capacity._sum.capacity ?? 0,
  };
}
