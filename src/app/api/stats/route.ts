import { connection, NextResponse } from "next/server";
import { getGlobalStats } from "@/lib/services/events";
import { handleApiError } from "@/lib/api";

/** GET /api/stats — totals across all events. */
export async function GET() {
  await connection();
  try {
    return NextResponse.json({ stats: await getGlobalStats() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return handleApiError(error);
  }
}
