import { connection, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, handleApiError } from "@/lib/api";

/** Byte-order mark so Excel opens the UTF-8 CSV with the right encoding. */
const UTF8_BOM = "\uFEFF";

function csvCell(value: string | null | undefined) {
  const v = value ?? "";
  // Quote everything; neutralise spreadsheet formula injection.
  const safe = /^[=+\-@]/.test(v) ? `'${v}` : v;
  return `"${safe.replace(/"/g, '""')}"`;
}

/** GET /api/events/:id/export — attendance sheet as CSV. */
export async function GET(_request: NextRequest, ctx: RouteContext<"/api/events/[id]/export">) {
  await connection();
  const { id } = await ctx.params;
  try {
    const event = await prisma.event.findUnique({
      where: { id },
      include: { registrations: { orderBy: { createdAt: "asc" } } },
    });
    if (!event) return apiError(404, "EVENT_NOT_FOUND", "This event doesn't exist.");

    const header = ["Name", "Email", "Student ID", "Department", "Entry code", "Registered at", "Checked in at"];
    const lines = event.registrations.map((r) =>
      [
        r.name,
        r.email,
        r.studentId,
        r.department,
        r.code,
        r.createdAt.toISOString(),
        r.checkedInAt?.toISOString() ?? "",
      ]
        .map(csvCell)
        .join(","),
    );
    const csv = UTF8_BOM + [header.map(csvCell).join(","), ...lines].join("\r\n");
    const slug =
      event.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 50) || "event";
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${slug}-attendance.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
