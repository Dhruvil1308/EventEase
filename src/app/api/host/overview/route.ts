import { connection, NextResponse } from "next/server";
import { Role } from "@/generated/prisma/enums";
import { handleApiError } from "@/lib/api";
import { requireApiRole } from "@/lib/api-auth";
import { getHostStats, listEventsForHost } from "@/lib/services/events";

/** GET /api/host/overview — the signed-in host's totals and events (the host dashboard). */
export async function GET() {
  await connection();
  const gate = await requireApiRole(Role.HOST);
  if ("response" in gate) return gate.response;
  try {
    const [stats, events] = await Promise.all([getHostStats(gate.profile.id), listEventsForHost(gate.profile.id)]);
    return NextResponse.json({ stats, events }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return handleApiError(error);
  }
}
