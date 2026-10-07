import { connection, NextResponse, type NextRequest } from "next/server";
import { listRegistrations, registerParticipant, toParticipantRow } from "@/lib/services/registrations";
import { getEventStats } from "@/lib/services/events";
import { apiError, handleApiError, invalidJson, readJson } from "@/lib/api";
import { requireApiEventOwner, requireApiRole } from "@/lib/api-auth";
import { Role } from "@/generated/prisma/enums";
import type { RegisterInput } from "@/lib/validation";

/** GET /api/events/:id/registrations — participant list. Owning host only: this
 *  is personal data (names, emails and live entry codes). */
export async function GET(_request: NextRequest, ctx: RouteContext<"/api/events/[id]/registrations">) {
  await connection();
  const { id } = await ctx.params;
  const gate = await requireApiEventOwner(id);
  if ("response" in gate) return gate.response;
  try {
    const stats = await getEventStats(id);
    if (!stats) return apiError(404, "EVENT_NOT_FOUND", "This event doesn't exist.");
    const registrations = await listRegistrations(id);
    return NextResponse.json({ stats, registrations: registrations.map(toParticipantRow) });
  } catch (error) {
    return handleApiError(error);
  }
}

/** POST /api/events/:id/registrations — register the signed-in attendee and
 *  issue their unique entry code. The ticket is always bound to the session,
 *  never to an email supplied in the body. */
export async function POST(request: NextRequest, ctx: RouteContext<"/api/events/[id]/registrations">) {
  const { id } = await ctx.params;
  const gate = await requireApiRole(Role.ATTENDEE);
  if ("response" in gate) return gate.response;

  const body = await readJson(request);
  if (!body) return invalidJson();
  try {
    const registration = await registerParticipant(id, body as RegisterInput, {
      id: gate.profile.id,
      email: gate.profile.email,
    });
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
