import { NextResponse, type NextRequest } from "next/server";
import { handleApiError, invalidJson, readJson } from "@/lib/api";
import { requireApiEventOwner } from "@/lib/api-auth";
import { updateReminderSettings } from "@/lib/services/reminders";
import type { ReminderSettingsInput } from "@/lib/validation";

/**
 * PUT /api/events/:id/reminders — schedule Aanaya's reminder: on/off, how
 * long before the start, which language, and "arrive N minutes early". Owner only.
 */
export async function PUT(request: NextRequest, ctx: RouteContext<"/api/events/[id]/reminders">) {
  const { id } = await ctx.params;
  const gate = await requireApiEventOwner(id);
  if ("response" in gate) return gate.response;
  const body = await readJson(request);
  if (!body) return invalidJson();
  try {
    await updateReminderSettings(id, body as ReminderSettingsInput);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
