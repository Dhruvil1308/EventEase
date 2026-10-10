/** EventEase's look on Android — the same palette as the website. */
export const colors = {
  bg: "#0a0918",
  bgElevated: "#110f24",
  card: "#16142d",
  cardStrong: "#1d1a3a",
  border: "rgba(255,255,255,0.08)",
  borderStrong: "rgba(255,255,255,0.16)",
  text: "#ffffff",
  textSoft: "#d4d4dc",
  textMuted: "#9b9bb0",
  textFaint: "#6b6b82",
  violet: "#7c5cff",
  violetSoft: "#a78bfa",
  cyan: "#22d3ee",
  pink: "#f472b6",
  success: "#34d399",
  danger: "#fb7185",
  warn: "#fbbf24",
} as const;

/** The signature violet → cyan → pink gradient. */
export const aurora = ["#7c5cff", "#22d3ee", "#f472b6"] as const;

/** Event themes, matching the website's (src/lib/themes.ts). */
export const THEMES = {
  aurora: { label: "Aurora", colors: ["#7c5cff", "#22d3ee", "#a78bfa"] },
  sunset: { label: "Sunset", colors: ["#fb7185", "#f97316", "#facc15"] },
  neon: { label: "Neon", colors: ["#a3e635", "#22d3ee", "#34d399"] },
  ocean: { label: "Ocean", colors: ["#3b82f6", "#06b6d4", "#2dd4bf"] },
  blossom: { label: "Blossom", colors: ["#f472b6", "#c084fc", "#818cf8"] },
  ember: { label: "Ember", colors: ["#ef4444", "#f59e0b", "#fb923c"] },
} as const;
export type ThemeId = keyof typeof THEMES;
export const THEME_IDS = Object.keys(THEMES) as ThemeId[];
export const themeColors = (id: string | null | undefined) =>
  (THEMES[(id ?? "aurora") as ThemeId] ?? THEMES.aurora).colors;

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
export const EVENT_TYPE_IDS = Object.keys(EVENT_TYPES) as EventTypeId[];
export const PRIZE_TYPES: EventTypeId[] = ["COMPETITION", "HACKATHON", "SPORTS", "CULTURAL"];
export const eventType = (id: string) => EVENT_TYPES[id as EventTypeId] ?? EVENT_TYPES.OTHER;

export const CALL_LANGUAGES = {
  en: { label: "English", native: "English" },
  hi: { label: "Hindi", native: "हिन्दी" },
  gu: { label: "Gujarati", native: "ગુજરાતી" },
} as const;
export type CallLanguage = keyof typeof CALL_LANGUAGES;
export const CALL_LANGUAGE_IDS = Object.keys(CALL_LANGUAGES) as CallLanguage[];

export const REMINDER_LEAD_PRESETS = [
  { minutes: 15, label: "15 min" },
  { minutes: 30, label: "30 min" },
  { minutes: 60, label: "1 hour" },
  { minutes: 120, label: "2 hours" },
  { minutes: 180, label: "3 hours" },
  { minutes: 1440, label: "1 day" },
] as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 10, md: 14, lg: 20, xl: 28, pill: 999 } as const;
