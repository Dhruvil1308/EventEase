import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiError, handleApiError, invalidJson, readJson } from "@/lib/api";
import { requireApiEventOwner } from "@/lib/api-auth";
import { CALL_LANGUAGE_IDS } from "@/lib/call-languages";
import { ensurePrompt } from "@/lib/services/reminders";

export const maxDuration = 60;

/**
 * POST /api/events/:id/reminders/preview — `{ language }`. Generates (or
 * reuses) exactly what Aanaya will say on the call, and returns the script
 * and the audio so the host can listen before anyone is dialled. Owner only.
 */
export async function POST(request: NextRequest, ctx: RouteContext<"/api/events/[id]/reminders/preview">) {
  const { id } = await ctx.params;
  const gate = await requireApiEventOwner(id);
  if ("response" in gate) return gate.response;
  const body = await readJson(request);
  if (!body) return invalidJson();
  const language = z.enum(CALL_LANGUAGE_IDS).safeParse(body.language);
  if (!language.success) return apiError(400, "VALIDATION_ERROR", "Pick English, Hindi or Gujarati.");
  try {
    return NextResponse.json({ prompt: await ensurePrompt(id, language.data) });
  } catch (error) {
    return handleApiError(error);
  }
}
