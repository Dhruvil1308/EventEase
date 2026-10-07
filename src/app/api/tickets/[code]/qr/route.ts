import { connection, type NextRequest } from "next/server";
import { getTicket } from "@/lib/services/registrations";
import { apiError, handleApiError } from "@/lib/api";
import { qrPng } from "@/lib/qr";

/** GET /api/tickets/:code/qr — downloadable PNG of the ticket's QR code. */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/tickets/[code]/qr">) {
  await connection();
  const { code } = await ctx.params;
  try {
    const ticket = await getTicket(code);
    if (!ticket) return apiError(404, "TICKET_NOT_FOUND", "No ticket matches this code.");
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
