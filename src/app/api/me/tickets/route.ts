import { connection, NextResponse } from "next/server";
import { Role } from "@/generated/prisma/enums";
import { handleApiError } from "@/lib/api";
import { requireApiRole } from "@/lib/api-auth";
import { mediaUrl } from "@/lib/media";
import { listRegistrationsForUser } from "@/lib/services/registrations";

/** GET /api/me/tickets — every ticket the signed-in attendee holds, with its event. */
export async function GET() {
  await connection();
  const gate = await requireApiRole(Role.ATTENDEE);
  if ("response" in gate) return gate.response;
  try {
    const rows = await listRegistrationsForUser(gate.profile.id);
    const tickets = rows.map((t) => ({
      code: t.code,
      checkedInAt: t.checkedInAt?.toISOString() ?? null,
      event: {
        id: t.eventId,
        name: t.eventName,
        venue: t.venue,
        startsAt: t.startsAt.toISOString(),
        endsAt: t.endsAt?.toISOString() ?? null,
        theme: t.theme,
        hostName: t.hostName,
        coverUrl: mediaUrl(t.coverPath),
      },
    }));
    return NextResponse.json({ tickets }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return handleApiError(error);
  }
}
