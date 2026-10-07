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

/** Registered + checked-in counts per event in a single grouped query. */
async function countsByEvent(eventIds?: string[]) {
  const rows = await prisma.registration.groupBy({
    by: ["eventId"],
    where: eventIds ? { eventId: { in: eventIds } } : undefined,
    _count: { _all: true, checkedInAt: true },
  });
  return new Map(rows.map((r) => [r.eventId, { registered: r._count._all, checkedIn: r._count.checkedInAt }]));
}

export async function listEvents(): Promise<EventSummary[]> {
  const [events, counts] = await Promise.all([
    prisma.event.findMany({ orderBy: { startsAt: "asc" }, include: { host: { select: { name: true } } } }),
    countsByEvent(),
  ]);
  return events.map((e) => {
    const c = counts.get(e.id);
    return toSummary(e, c?.registered ?? 0, c?.checkedIn ?? 0);
  });
}

export async function getEventSummary(id: string): Promise<EventSummary | null> {
  const event = await prisma.event.findUnique({ where: { id }, include: { host: { select: { name: true } } } });
  if (!event) return null;
  const counts = await getEventCounts(id);
  return toSummary(event, counts.registered, counts.checkedIn);
}

export async function getEventCounts(eventId: string) {
  const [registered, checkedIn] = await Promise.all([
    prisma.registration.count({ where: { eventId } }),
    prisma.registration.count({ where: { eventId, checkedInAt: { not: null } } }),
  ]);
  return { registered, checkedIn };
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

/** Every event this host owns, newest first. */
export async function listEventsForHost(hostId: string): Promise<EventSummary[]> {
  const events = await prisma.event.findMany({
    where: { hostId },
    orderBy: { startsAt: "asc" },
    include: { host: { select: { name: true } } },
  });
  const counts = await countsByEvent(events.map((e) => e.id));
  return events.map((e) => {
    const c = counts.get(e.id);
    return toSummary(e, c?.registered ?? 0, c?.checkedIn ?? 0);
  });
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
