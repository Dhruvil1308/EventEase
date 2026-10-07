import { connection, NextResponse, type NextRequest } from "next/server";
import { toParticipantRow } from "@/lib/services/registrations";
import { apiError, handleApiError } from "@/lib/api";
import { resolveTicketAccess } from "@/lib/ticket-access";

/** GET /api/tickets/:code — look up a ticket (participant + event) by entry code. */
export async function GET(_request: NextRequest, ctx: RouteContext<"/api/tickets/[code]">) {
  await connection();
  const { code } = await ctx.params;
  try {
    const access = await resolveTicketAccess(code);
    if (!access.ok) {
      if (access.reason === "NOT_FOUND") return apiError(404, "TICKET_NOT_FOUND", "No ticket matches this code.");
      if (access.reason === "UNAUTHORIZED") return apiError(401, "UNAUTHORIZED", "Sign in to view this ticket.");
      return apiError(403, "FORBIDDEN", "This ticket belongs to someone else.");
    }
    const { event, ...registration } = access.ticket;
    return NextResponse.json({
      ticket: toParticipantRow(registration),
      event: {
        id: event.id,
        name: event.name,
        venue: event.venue,
        startsAt: event.startsAt.toISOString(),
        theme: event.theme,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
