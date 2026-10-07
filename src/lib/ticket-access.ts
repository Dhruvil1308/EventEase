import "server-only";

import { Role } from "@/generated/prisma/enums";
import { getCurrentProfile } from "@/lib/auth";
import { getTicket } from "@/lib/services/registrations";

/**
 * A ticket carries someone's name, email and a live entry code, so it is only
 * readable by the attendee who holds it or the host running that event.
 * Knowing the code is no longer enough on its own.
 */
export type TicketAccess =
  | { ok: true; ticket: NonNullable<Awaited<ReturnType<typeof getTicket>>>; viewer: "owner" | "host" }
  | { ok: false; reason: "NOT_FOUND" | "UNAUTHORIZED" | "FORBIDDEN" };

export async function resolveTicketAccess(code: string): Promise<TicketAccess> {
  const ticket = await getTicket(code);
  if (!ticket) return { ok: false, reason: "NOT_FOUND" };

  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, reason: "UNAUTHORIZED" };

  if (profile.role === Role.ATTENDEE && ticket.userId === profile.id) {
    return { ok: true, ticket, viewer: "owner" };
  }
  if (profile.role === Role.HOST && ticket.event.hostId === profile.id) {
    return { ok: true, ticket, viewer: "host" };
  }
  return { ok: false, reason: "FORBIDDEN" };
}
