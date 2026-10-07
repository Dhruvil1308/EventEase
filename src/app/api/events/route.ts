import { connection, NextResponse } from "next/server";
import { createEvent, listEvents } from "@/lib/services/events";
import { handleApiError, invalidJson, readJson } from "@/lib/api";
import { requireApiRole } from "@/lib/api-auth";
import { Role } from "@/generated/prisma/enums";
import type { CreateEventInput } from "@/lib/validation";

/** GET /api/events — every event with live registration & attendance counts. */
export async function GET() {
  await connection();
  try {
    return NextResponse.json({ events: await listEvents() });
  } catch (error) {
    return handleApiError(error);
  }
}

/** POST /api/events — create an event with a participant capacity. Hosts only. */
export async function POST(request: Request) {
  const gate = await requireApiRole(Role.HOST);
  if ("response" in gate) return gate.response;

  const body = await readJson(request);
  if (!body) return invalidJson();
  try {
    const event = await createEvent(body as CreateEventInput, gate.profile.id);
    return NextResponse.json({ event }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
