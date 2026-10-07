import { connection, NextResponse, type NextRequest } from "next/server";
import { deleteEvent, getEventSummary } from "@/lib/services/events";
import { apiError, handleApiError } from "@/lib/api";
import { requireApiEventOwner } from "@/lib/api-auth";

/** GET /api/events/:id — event details with registration & attendance counts. */
export async function GET(_request: NextRequest, ctx: RouteContext<"/api/events/[id]">) {
  await connection();
  const { id } = await ctx.params;
  try {
    const event = await getEventSummary(id);
    if (!event) return apiError(404, "EVENT_NOT_FOUND", "This event doesn't exist.");
    return NextResponse.json({ event });
  } catch (error) {
    return handleApiError(error);
  }
}

/** DELETE /api/events/:id — removes the event with its registrations and logs. Owner only. */
export async function DELETE(_request: NextRequest, ctx: RouteContext<"/api/events/[id]">) {
  const { id } = await ctx.params;
  const gate = await requireApiEventOwner(id);
  if ("response" in gate) return gate.response;
  try {
    await deleteEvent(id, gate.profile.id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return handleApiError(error);
  }
}
