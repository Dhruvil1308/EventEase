import { connection, type NextRequest } from "next/server";
import { apiError, handleApiError } from "@/lib/api";
import { resolveTicketAccess } from "@/lib/ticket-access";
import { qrPng } from "@/lib/qr";

/** GET /api/tickets/:code/qr — downloadable PNG of the ticket's QR code. */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/tickets/[code]/qr">) {
  await connection();
  const { code } = await ctx.params;
  try {
    const access = await resolveTicketAccess(code);
    if (!access.ok) {
      if (access.reason === "NOT_FOUND") return apiError(404, "TICKET_NOT_FOUND", "No ticket matches this code.");
      if (access.reason === "UNAUTHORIZED") return apiError(401, "UNAUTHORIZED", "Sign in to view this ticket.");
      return apiError(403, "FORBIDDEN", "This ticket belongs to someone else.");
    }
    const ticket = access.ticket;
    const png = await qrPng(ticket.code);
    const download = request.nextUrl.searchParams.has("download");
    return new Response(new Uint8Array(png), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "private, max-age=3600",
        ...(download ? { "Content-Disposition": `attachment; filename="eventease-${ticket.code}.png"` } : {}),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
