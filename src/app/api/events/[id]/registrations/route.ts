import { connection, NextResponse, type NextRequest } from "next/server";
import { listRegistrations, registerParticipant, toParticipantRow } from "@/lib/services/registrations";
import { getEventStats } from "@/lib/services/events";
import { apiError, handleApiError, invalidJson, readJson } from "@/lib/api";
import type { RegisterInput } from "@/lib/validation";

/** GET /api/events/:id/registrations — participant list for the organizer. */
export async function GET(_request: NextRequest, ctx: RouteContext<"/api/events/[id]/registrations">) {
  await connection();
  const { id } = await ctx.params;
  try {
    const stats = await getEventStats(id);
    if (!stats) return apiError(404, "EVENT_NOT_FOUND", "This event doesn't exist.");
    const registrations = await listRegistrations(id);
    return NextResponse.json({ stats, registrations: registrations.map(toParticipantRow) });
  } catch (error) {
    return handleApiError(error);
  }
}

/** POST /api/events/:id/registrations — register a participant and issue a unique entry code. */
export async function POST(request: NextRequest, ctx: RouteContext<"/api/events/[id]/registrations">) {
  const { id } = await ctx.params;
  const body = await readJson(request);
  if (!body) return invalidJson();
  try {
    const registration = await registerParticipant(id, body as RegisterInput);
    return NextResponse.json(
      {
        registration: toParticipantRow(registration),
        ticketUrl: `/tickets/${registration.code}`,
      },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error);
  }
}
