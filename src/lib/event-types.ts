/** What kind of event this is. Competitions and hackathons get a prize list. */
export const EVENT_TYPES = {
  WORKSHOP: { label: "Workshop", emoji: "🛠️" },
  COMPETITION: { label: "Competition", emoji: "🏆" },
  HACKATHON: { label: "Hackathon", emoji: "💻" },
  SEMINAR: { label: "Seminar", emoji: "🎤" },
  CULTURAL: { label: "Cultural", emoji: "🎭" },
  SPORTS: { label: "Sports", emoji: "⚽" },
  MEETUP: { label: "Meetup", emoji: "🤝" },
  OTHER: { label: "Event", emoji: "✨" },
} as const;

export type EventTypeId = keyof typeof EVENT_TYPES;
export const EVENT_TYPE_IDS = Object.keys(EVENT_TYPES) as [EventTypeId, ...EventTypeId[]];

export function getEventType(id: string | null | undefined) {
  return EVENT_TYPES[(id ?? "OTHER") as EventTypeId] ?? EVENT_TYPES.OTHER;
}

/** Types where prizes are the point, so the form opens the prize editor by default. */
export const PRIZE_TYPES: readonly EventTypeId[] = ["COMPETITION", "HACKATHON", "SPORTS", "CULTURAL"];

export type Prize = { title: string; reward: string };

/** Reads the `prizes` JSON column defensively — it is user-supplied data. */
export function parsePrizes(value: unknown): Prize[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((p): p is Prize => Boolean(p) && typeof p.title === "string" && typeof p.reward === "string")
    .map((p) => ({ title: p.title, reward: p.reward }));
}

export const formatFee = (rupees: number) => (rupees > 0 ? `₹${rupees.toLocaleString("en-IN")}` : "Free");
