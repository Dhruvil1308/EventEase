import { buildStats, type EventStats } from "./events";
import { listRegistrations, toParticipantRow, type ParticipantRow } from "./registrations";
import { gateCounts, recentActivity, type ActivityItem, type GateCounts } from "./checkin";
import { prisma } from "@/lib/prisma";

export type EventLiveData = {
  stats: EventStats;
  gate: GateCounts;
  participants: ParticipantRow[];
  activity: ActivityItem[];
};

/**
 * Everything the organizer dashboard shows for one event, or null if it doesn't
 * exist.
 *
 * The dashboard polls this every few seconds, so all four reads are issued in
 * one parallel wave — the cost is a single network round trip, not eight.
 */
export async function getEventLive(eventId: string): Promise<EventLiveData | null> {
  const [capacityRows, registrations, activity, gate] = await Promise.all([
    prisma.$queryRaw<{ capacity: number; registered: number; checkedIn: number }[]>`
      SELECT e.capacity,
             COALESCE(c.registered, 0)::int AS registered,
             COALESCE(c."checkedIn", 0)::int AS "checkedIn"
      FROM "Event" e
      LEFT JOIN (
        SELECT "eventId", COUNT(*)::int AS registered, COUNT("checkedInAt")::int AS "checkedIn"
        FROM "Registration" WHERE "eventId" = ${eventId} GROUP BY "eventId"
      ) c ON c."eventId" = e.id
      WHERE e.id = ${eventId}`,
    listRegistrations(eventId),
    recentActivity(eventId, 15),
    gateCounts(eventId),
  ]);

  const row = capacityRows[0];
  if (!row) return null;

  return {
    stats: buildStats(row.capacity, row.registered, row.checkedIn),
    gate,
    participants: registrations.map(toParticipantRow),
    activity,
  };
}
