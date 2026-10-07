import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { generateEntryCode, normalizeEntryCode } from "@/lib/codes";
import { fieldErrors, registerSchema, type RegisterInput } from "@/lib/validation";

const MAX_CODE_ATTEMPTS = 5;

/** Thrown inside the transaction to roll back a registration that overflowed capacity. */
class CapacityExceeded extends Error {}

/**
 * Detects a unique-constraint violation and which columns caused it. Driver
 * adapters report the constraint in slightly different shapes, so we check all
 * of them.
 */
function uniqueViolationFields(error: unknown): string[] | null {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") return null;
  const meta = (error.meta ?? {}) as Record<string, unknown>;
  const target = meta.target;
  if (Array.isArray(target)) return target.map(String);
  if (typeof target === "string") return [target];
  const adapterFields = (meta.driverAdapterError as { cause?: { constraint?: { fields?: string[] } } } | undefined)
    ?.cause?.constraint?.fields;
  if (Array.isArray(adapterFields)) return adapterFields.map(String);
  return [error.message];
}

const mentions = (fields: string[], column: string) =>
  fields.some((f) => f.replace(/[`"]/g, "").toLowerCase().includes(column.toLowerCase()));

export async function registerParticipant(eventId: string, input: RegisterInput) {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError("VALIDATION_ERROR", "Please fix the highlighted fields.", fieldErrors(parsed.error));
  }
  const data = parsed.data;

  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) throw new AppError("EVENT_NOT_FOUND", "This event doesn't exist (it may have been deleted).");

  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
        // Insert first, then verify capacity inside the same transaction.
        // SQLite serialises writers, so once our insert holds the write lock no
        // other registration can slip in between the insert and the count —
        // the event can never be over-booked, even under concurrent requests.
        const registration = await tx.registration.create({
          data: {
            eventId,
            name: data.name,
            email: data.email,
            studentId: data.studentId,
            department: data.department,
            code: generateEntryCode(),
          },
        });
        const registered = await tx.registration.count({ where: { eventId } });
        if (registered > event.capacity) throw new CapacityExceeded();
        return { ...registration, event };
      });
    } catch (error) {
      if (error instanceof CapacityExceeded) {
        throw new AppError("EVENT_FULL", `Sorry — all ${event.capacity} seats for this event are taken.`);
      }
      const fields = uniqueViolationFields(error);
      if (fields && mentions(fields, "email")) {
        throw new AppError("ALREADY_REGISTERED", "This email is already registered for this event.", {
          email: ["This email is already registered for this event."],
        });
      }
      // A code collision: astronomically unlikely, but simply try a fresh code.
      if (fields && mentions(fields, "code")) continue;
      throw error;
    }
  }
  throw new AppError("CODE_GENERATION_FAILED", "Couldn't generate a unique entry code. Please try again.");
}

export async function getTicket(rawCode: string) {
  const code = normalizeEntryCode(rawCode);
  if (!code) return null;
  return prisma.registration.findUnique({ where: { code }, include: { event: true } });
}

export async function listRegistrations(eventId: string) {
  return prisma.registration.findMany({
    where: { eventId },
    orderBy: { createdAt: "desc" },
  });
}

export type ParticipantRow = {
  id: string;
  name: string;
  email: string;
  studentId: string | null;
  department: string | null;
  code: string;
  checkedInAt: string | null;
  createdAt: string;
};

export function toParticipantRow(r: {
  id: string;
  name: string;
  email: string;
  studentId: string | null;
  department: string | null;
  code: string;
  checkedInAt: Date | null;
  createdAt: Date;
}): ParticipantRow {
  return {
    id: r.id,
    name: r.name,
    email: r.email,
    studentId: r.studentId,
    department: r.department,
    code: r.code,
    checkedInAt: r.checkedInAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
  };
}
