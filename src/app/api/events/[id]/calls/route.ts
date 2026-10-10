import { after, connection, NextResponse, type NextRequest } from "next/server";
import { apiError, handleApiError, invalidJson, readJson } from "@/lib/api";
import { requireApiEventOwner } from "@/lib/api-auth";
import { cancelQueuedCalls, dispatchNext, enqueueCalls, getCallConsole } from "@/lib/services/reminders";
import { fieldErrors, startCallsSchema } from "@/lib/validation";

/** GET /api/events/:id/calls — every registrant with their mobile number and call status. Owner only. */
export async function GET(_request: NextRequest, ctx: RouteContext<"/api/events/[id]/calls">) {
  await connection();
  const { id } = await ctx.params;
  const gate = await requireApiEventOwner(id);
  if ("response" in gate) return gate.response;
  try {
    const data = await getCallConsole(id);
    if (!data) return apiError(404, "EVENT_NOT_FOUND", "This event doesn't exist.");
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/events/:id/calls — queue reminder calls and start dialling, one
 * person at a time. Body: `{ registrationIds?, language?, skipReached? }`;
 * no ids means everyone with a number. Owner only.
 */
export async function POST(request: NextRequest, ctx: RouteContext<"/api/events/[id]/calls">) {
  const { id } = await ctx.params;
  const gate = await requireApiEventOwner(id);
  if ("response" in gate) return gate.response;
  const body = await readJson(request);
  if (!body) return invalidJson();
  const parsed = startCallsSchema.safeParse(body);
  if (!parsed.success) return apiError(400, "VALIDATION_ERROR", "Invalid call request.", fieldErrors(parsed.error));

  try {
    const result = await enqueueCalls(id, { ...parsed.data, trigger: "MANUAL" });
    if (result.queued === 0) {
      const why = result.alreadyQueued
        ? "already in the call queue"
        : result.alreadyReached
          ? "already reached — untick “skip people already reached” to call again"
          : "missing a mobile number";
      return apiError(409, "NOTHING_TO_CALL", `Nobody to call: everyone selected is ${why}.`);
    }
    after(() => dispatchNext(id));
    return NextResponse.json(result, { status: 202 });
  } catch (error) {
    return handleApiError(error);
  }
}

/** DELETE /api/events/:id/calls — cancel everything still waiting in the queue. Owner only. */
export async function DELETE(_request: NextRequest, ctx: RouteContext<"/api/events/[id]/calls">) {
  const { id } = await ctx.params;
  const gate = await requireApiEventOwner(id);
  if ("response" in gate) return gate.response;
  try {
    return NextResponse.json({ canceled: await cancelQueuedCalls(id) });
  } catch (error) {
    return handleApiError(error);
  }
}
