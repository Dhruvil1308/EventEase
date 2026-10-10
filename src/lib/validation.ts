import { z } from "zod";
import { CALL_LANGUAGE_IDS, REMINDER_LANGUAGE_IDS } from "./call-languages";
import { EVENT_TYPE_IDS } from "./event-types";
import { normalizePhone } from "./phone";
import { THEME_IDS } from "./themes";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Must be ${max} characters or fewer`)
    .optional()
    .transform((v) => (v ? v : undefined));

/** Like `optionalText`, but an emptied field becomes `null` so an edit can clear it. */
const nullableText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Must be ${max} characters or fewer`)
    .nullish()
    .transform((v) => (v ? v : null));

/** Any way a person types a mobile number, stored as E.164. Empty means "none". */
const optionalPhone = z
  .string()
  .trim()
  .max(24, "That number is too long")
  .nullish()
  .transform((v, ctx) => {
    if (!v) return null;
    const phone = normalizePhone(v);
    if (!phone) {
      ctx.addIssue({ code: "custom", message: "Enter a valid mobile number, e.g. 98765 43210" });
      return z.NEVER;
    }
    return phone;
  });

/**
 * A profile link. Accepts a full URL, a bare domain, or just a username —
 * `ada` becomes https://github.com/ada.
 */
const profileUrl = (site: "github" | "linkedin") =>
  z
    .string()
    .trim()
    .max(200, "That link is too long")
    .nullish()
    .transform((v, ctx) => {
      if (!v) return null;
      let value = v;
      if (/^[\w.-]+$/.test(value) && !value.includes(".")) {
        value = site === "github" ? `https://github.com/${value}` : `https://www.linkedin.com/in/${value}`;
      } else if (!/^https?:\/\//i.test(value)) {
        value = `https://${value}`;
      }
      try {
        const url = new URL(value);
        if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error();
        return url.toString();
      } catch {
        ctx.addIssue({ code: "custom", message: "Enter a valid link" });
        return z.NEVER;
      }
    });

/** Skills and hobbies: short tags, trimmed, de-duplicated case-insensitively. */
const tagList = (noun: string) =>
  z
    .array(z.string().trim().min(1).max(32, `Keep each ${noun} under 32 characters`))
    .max(15, `Add up to 15 ${noun}s`)
    .default([])
    .transform((tags) => {
      const seen = new Set<string>();
      return tags.filter((t) => {
        const key = t.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    });

/** "" or null means "no end time"; anything else must be a real date. */
const optionalDate = z
  .union([z.literal(""), z.null(), z.coerce.date({ error: "Pick a valid date and time" })])
  .optional()
  .transform((v) => (v instanceof Date && !Number.isNaN(v.getTime()) ? v : null));

export const prizeSchema = z.object({
  title: z.string().trim().min(1, "Name the prize").max(40, "Keep the prize name under 40 characters"),
  reward: z.string().trim().min(1, "Say what the winner gets").max(80, "Keep the reward under 80 characters"),
});

export const reminderSettingsSchema = z.object({
  reminderEnabled: z.boolean().default(false),
  reminderLeadMinutes: z.coerce
    .number({ error: "Pick when to call" })
    .int("Use whole minutes")
    .min(5, "Call at least 5 minutes before the start")
    .max(7 * 24 * 60, "Call at most 7 days before the start")
    .default(60),
  reminderLanguage: z.enum(REMINDER_LANGUAGE_IDS).default("auto"),
  reminderArriveEarly: z.coerce
    .number({ error: "Enter a number of minutes" })
    .int("Use whole minutes")
    .min(0, "Can't be negative")
    .max(120, "At most 120 minutes")
    .default(10),
});

const eventFields = z.object({
  name: z
    .string()
    .trim()
    .min(3, "Give the event a name (at least 3 characters)")
    .max(80, "Keep the name under 80 characters"),
  description: z.string().trim().max(600, "Keep the description under 600 characters").default(""),
  venue: z.string().trim().min(2, "Where is it happening?").max(120, "Keep the venue under 120 characters"),
  startsAt: z.coerce
    .date({ error: "Pick a valid date and time" })
    .refine((d) => !Number.isNaN(d.getTime()), "Pick a valid date and time"),
  endsAt: optionalDate,
  capacity: z.coerce
    .number({ error: "Capacity must be a number" })
    .int("Capacity must be a whole number")
    .min(1, "Capacity must be at least 1")
    .max(100_000, "Capacity can't exceed 100,000"),
  theme: z.enum(THEME_IDS).default("aurora"),
  type: z.enum(EVENT_TYPE_IDS).default("OTHER"),
  entryFee: z.coerce
    .number({ error: "Entry fee must be a number" })
    .int("Use whole rupees")
    .min(0, "Entry fee can't be negative")
    .max(1_000_000, "That entry fee is too high")
    .default(0),
  prizes: z.array(prizeSchema).max(10, "Add up to 10 prizes").default([]),
  ...reminderSettingsSchema.shape,
});

export const createEventSchema = eventFields.superRefine((event, ctx) => {
  if (event.endsAt && event.endsAt.getTime() <= event.startsAt.getTime()) {
    ctx.addIssue({ code: "custom", path: ["endsAt"], message: "The end must be after the start" });
  }
});

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Enter the participant's full name").max(80, "Name is too long"),
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address").max(254, "Email is too long")),
  studentId: optionalText(40),
  department: optionalText(80),
  phone: optionalPhone,
  callLanguage: z.enum(CALL_LANGUAGE_IDS).optional(),
});

export const checkInSchema = z.object({
  code: z.string().trim().min(1, "Enter or scan an entry code").max(500),
  eventId: z.string().trim().min(1).optional(),
});

export const profileSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name").max(80, "Name is too long"),
  phone: optionalPhone,
  bio: nullableText(280),
  skills: tagList("skill"),
  hobbies: tagList("hobby"),
  college: nullableText(120),
  city: nullableText(60),
  organization: nullableText(120),
  studentId: nullableText(40),
  department: nullableText(80),
  linkedinUrl: profileUrl("linkedin"),
  githubUrl: profileUrl("github"),
  callLanguage: z.enum(CALL_LANGUAGE_IDS).default("hi"),
});

export const startCallsSchema = z.object({
  /** Specific registrations to call, or omit to call everyone with a number. */
  registrationIds: z.array(z.string().min(1)).max(5000).optional(),
  /** Force one language for this batch; omit to use the event's setting. */
  language: z.enum(CALL_LANGUAGE_IDS).optional(),
  /** Skip people who already picked up a reminder for this event. */
  skipReached: z.boolean().default(true),
});

export type CreateEventInput = z.input<typeof createEventSchema>;
export type RegisterInput = z.input<typeof registerSchema>;
export type CheckInInput = z.input<typeof checkInSchema>;
export type ProfileInput = z.input<typeof profileSchema>;
export type ReminderSettingsInput = z.input<typeof reminderSettingsSchema>;

export type FieldErrors = Record<string, string[] | undefined>;

export function fieldErrors(error: z.ZodError): FieldErrors {
  return z.flattenError(error).fieldErrors as FieldErrors;
}

export const signUpSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name").max(80, "Name is too long"),
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address").max(254, "Email is too long")),
  password: z.string().min(8, "Use at least 8 characters").max(72, "Passwords can be at most 72 characters"),
  organization: optionalText(120),
  studentId: optionalText(40),
  department: optionalText(80),
  phone: optionalPhone,
});

export const signInSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address")),
  password: z.string().min(1, "Enter your password"),
});

export type SignUpInput = z.infer<typeof signUpSchema>;
export type SignInInput = z.infer<typeof signInSchema>;
