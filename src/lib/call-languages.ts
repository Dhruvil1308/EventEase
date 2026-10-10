/** Languages Aanaya can make a reminder call in. Shared by forms and the call engine. */
export const CALL_LANGUAGES = {
  en: { label: "English", native: "English", sarvam: "en-IN" },
  hi: { label: "Hindi", native: "हिन्दी", sarvam: "hi-IN" },
  gu: { label: "Gujarati", native: "ગુજરાતી", sarvam: "gu-IN" },
} as const;

export type CallLanguage = keyof typeof CALL_LANGUAGES;
export const CALL_LANGUAGE_IDS = Object.keys(CALL_LANGUAGES) as [CallLanguage, ...CallLanguage[]];

/** An event's language setting: one fixed language, or each attendee's own preference. */
export const REMINDER_LANGUAGE_IDS = ["auto", ...CALL_LANGUAGE_IDS] as const;
export type ReminderLanguage = (typeof REMINDER_LANGUAGE_IDS)[number];

export const isCallLanguage = (v: unknown): v is CallLanguage => typeof v === "string" && v in CALL_LANGUAGES;

/** Lead-time presets offered for scheduled reminders, in minutes before the start. */
export const REMINDER_LEAD_PRESETS = [
  { minutes: 15, label: "15 min" },
  { minutes: 30, label: "30 min" },
  { minutes: 60, label: "1 hour" },
  { minutes: 120, label: "2 hours" },
  { minutes: 180, label: "3 hours" },
  { minutes: 1440, label: "1 day" },
] as const;

export function formatLead(minutes: number): string {
  if (minutes % 1440 === 0) return `${minutes / 1440} day${minutes === 1440 ? "" : "s"}`;
  if (minutes % 60 === 0) return `${minutes / 60} hour${minutes === 60 ? "" : "s"}`;
  if (minutes > 60) return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
  return `${minutes} min`;
}
