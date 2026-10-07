import { connection, NextResponse, type NextRequest } from "next/server";
import { getTicket, toParticipantRow } from "@/lib/services/registrations";
import { apiError, handleApiError } from "@/lib/api";

/** GET /api/tickets/:code — look up a ticket (participant + event) by entry code. */
export async function GET(_request: NextRequest, ctx: RouteContext<"/api/tickets/[code]">) {
  await connection();
  const { code } = await ctx.params;
  try {
    const ticket = await getTicket(code);
    if (!ticket) return apiError(404, "TICKET_NOT_FOUND", "No ticket matches this code.");
    const { event, ...registration } = ticket;
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
