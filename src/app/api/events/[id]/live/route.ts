import { connection, NextResponse, type NextRequest } from "next/server";
import { getEventLive } from "@/lib/services/live";
import { apiError, handleApiError } from "@/lib/api";

/**
 * GET /api/events/:id/live — everything the organizer dashboard needs to stay
 * in sync (counts, participants, latest gate activity). Polled every few seconds.
 */
export async function GET(_request: NextRequest, ctx: RouteContext<"/api/events/[id]/live">) {
  await connection();
  const { id } = await ctx.params;
  try {
    const live = await getEventLive(id);
    if (!live) return apiError(404, "EVENT_NOT_FOUND", "This event doesn't exist.");
    return NextResponse.json(live, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return handleApiError(error);
  }
}
