import { getEventStats, type EventStats } from "./events";
import { listRegistrations, toParticipantRow, type ParticipantRow } from "./registrations";
import { gateCounts, recentActivity, type ActivityItem, type GateCounts } from "./checkin";

export type EventLiveData = {
  stats: EventStats;
  gate: GateCounts;
  participants: ParticipantRow[];
  activity: ActivityItem[];
};

/** Everything the organizer dashboard shows for one event, or null if it doesn't exist. */
export async function getEventLive(eventId: string): Promise<EventLiveData | null> {
  const stats = await getEventStats(eventId);
  if (!stats) return null;
  const [registrations, activity, gate] = await Promise.all([
    listRegistrations(eventId),
    recentActivity(eventId, 15),
    gateCounts(eventId),
  ]);
  return { stats, gate, participants: registrations.map(toParticipantRow), activity };
}
