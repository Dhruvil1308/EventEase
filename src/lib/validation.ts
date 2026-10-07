import { z } from "zod";
import { THEME_IDS } from "./themes";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Must be ${max} characters or fewer`)
    .optional()
    .transform((v) => (v ? v : undefined));

export const createEventSchema = z.object({
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
  capacity: z.coerce
    .number({ error: "Capacity must be a number" })
    .int("Capacity must be a whole number")
    .min(1, "Capacity must be at least 1")
    .max(100_000, "Capacity can't exceed 100,000"),
  theme: z.enum(THEME_IDS).default("aurora"),
});

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Enter the participant's full name").max(80, "Name is too long"),
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address").max(254, "Email is too long")),
  studentId: optionalText(40),
  department: optionalText(80),
});

export const checkInSchema = z.object({
  code: z.string().trim().min(1, "Enter or scan an entry code").max(500),
  eventId: z.string().trim().min(1).optional(),
});

export type CreateEventInput = z.input<typeof createEventSchema>;
export type RegisterInput = z.input<typeof registerSchema>;
export type CheckInInput = z.input<typeof checkInSchema>;

export type FieldErrors = Record<string, string[] | undefined>;

export function fieldErrors(error: z.ZodError): FieldErrors {
  return z.flattenError(error).fieldErrors as FieldErrors;
}
