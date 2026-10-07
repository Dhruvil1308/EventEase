import { NextResponse } from "next/server";
import { checkIn } from "@/lib/services/checkin";
import { apiError, handleApiError, invalidJson, readJson } from "@/lib/api";
import { checkInSchema, fieldErrors } from "@/lib/validation";
import { requireApiRole } from "@/lib/api-auth";
import { Role } from "@/generated/prisma/enums";

const HTTP_STATUS = { SUCCESS: 200, DUPLICATE: 409, WRONG_EVENT: 409, INVALID: 404 } as const;

/**
 * POST /api/checkin — verify an entry code and check the participant in.
 * Body: { code: string, eventId?: string }
 *
 * 200 SUCCESS      first valid scan, participant admitted
 * 409 DUPLICATE    code already used — second check-in rejected
 * 409 WRONG_EVENT  valid ticket, but for a different event than this gate
 * 404 INVALID      no ticket with this code
 *
 * Hosts only, and scoped to their own events.
 */
export async function POST(request: Request) {
  const gate = await requireApiRole(Role.HOST);
  if ("response" in gate) return gate.response;

  const body = await readJson(request);
  if (!body) return invalidJson();
  const parsed = checkInSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(400, "VALIDATION_ERROR", "Enter or scan an entry code.", fieldErrors(parsed.error));
  }
  try {
    const result = await checkIn(parsed.data.code, parsed.data.eventId, gate.profile.id);
    return NextResponse.json(result, { status: HTTP_STATUS[result.status] });
  } catch (error) {
    return handleApiError(error);
  }
}
