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

/** Who the ticket belongs to. Always the signed-in attendee — never user input. */
export type RegisteringUser = { id: string; email: string };

export async function registerParticipant(eventId: string, input: RegisterInput, user: RegisteringUser) {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError("VALIDATION_ERROR", "Please fix the highlighted fields.", fieldErrors(parsed.error));
  }
  const data = parsed.data;

  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) throw new AppError("EVENT_NOT_FOUND", "This event doesn't exist (it may have been deleted).");

  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          // Postgres (unlike SQLite) lets concurrent transactions insert and count
          // without seeing each other, so counting alone would let two people take
          // the last seat. Locking the event row first serialises registrations for
          // THIS event only — other events still register in parallel.
          await tx.$queryRaw`SELECT id FROM "Event" WHERE id = ${eventId} FOR UPDATE`;

          const registered = await tx.registration.count({ where: { eventId } });
          if (registered >= event.capacity) throw new CapacityExceeded();

          const registration = await tx.registration.create({
            data: {
              eventId,
              userId: user.id,
              name: data.name,
              email: user.email,
              studentId: data.studentId,
              department: data.department,
              code: generateEntryCode(),
            },
          });
          return { ...registration, event };
        },
        {
          // Registrations for one event are serialised by the row lock above, so a
          // burst of sign-ups queues rather than running in parallel. These budgets
          // let the queue drain instead of failing with an opaque transaction error.
          maxWait: 10_000,
          timeout: 15_000,
        },
      );
    } catch (error) {
      if (error instanceof CapacityExceeded) {
        throw new AppError("EVENT_FULL", `Sorry — all ${event.capacity} seats for this event are taken.`);
      }
      const fields = uniqueViolationFields(error);
      if (fields && (mentions(fields, "userId") || mentions(fields, "email"))) {
        throw new AppError("ALREADY_REGISTERED", "You already have a ticket for this event.", {
          email: ["You already have a ticket for this event."],
        });
      }
      // A code collision: astronomically unlikely, but simply try a fresh code.
      if (fields && mentions(fields, "code")) continue;
      throw error;
    }
  }
  throw new AppError("CODE_GENERATION_FAILED", "Couldn't generate a unique entry code. Please try again.");
}

/** The ticket this attendee holds for an event, if any. */
export async function getRegistrationFor(eventId: string, userId: string) {
  return prisma.registration.findUnique({ where: { eventId_userId: { eventId, userId } } });
}

export type UserTicketRow = {
  code: string;
  checkedInAt: Date | null;
  eventId: string;
  eventName: string;
  venue: string;
  startsAt: Date;
  theme: string;
  hostName: string;
};

/**
 * Every ticket an attendee holds, with its event — powers the attendee
 * dashboard. Nested `include`s would cost three round trips; this is one join.
 */
export async function listRegistrationsForUser(userId: string): Promise<UserTicketRow[]> {
  return prisma.$queryRaw<UserTicketRow[]>`
    SELECT r.code, r."checkedInAt",
           e.id AS "eventId", e.name AS "eventName", e.venue, e."startsAt", e.theme,
           p.name AS "hostName"
    FROM "Registration" r
    JOIN "Event" e ON e.id = r."eventId"
    JOIN "Profile" p ON p.id = e."hostId"
    WHERE r."userId" = ${userId}::uuid
    ORDER BY e."startsAt" ASC`;
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
