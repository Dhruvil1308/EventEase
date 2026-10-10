import { NextResponse, type NextRequest } from "next/server";
import { handleApiError } from "@/lib/api";
import { requireApiEventOwner } from "@/lib/api-auth";
import { readImageUpload, setEventCover } from "@/lib/services/media";

/** PUT /api/events/:id/cover — multipart `file`, an image of at most 300 KB. Owner only. */
export async function PUT(request: NextRequest, ctx: RouteContext<"/api/events/[id]/cover">) {
  const { id } = await ctx.params;
  const gate = await requireApiEventOwner(id);
  if ("response" in gate) return gate.response;
  try {
    const file = await readImageUpload(request);
    return NextResponse.json(await setEventCover(id, gate.profile.id, file));
  } catch (error) {
    return handleApiError(error);
  }
}

/** DELETE /api/events/:id/cover — remove the banner image. Owner only. */
export async function DELETE(_request: NextRequest, ctx: RouteContext<"/api/events/[id]/cover">) {
  const { id } = await ctx.params;
  const gate = await requireApiEventOwner(id);
  if ("response" in gate) return gate.response;
  try {
    return NextResponse.json(await setEventCover(id, gate.profile.id, null));
  } catch (error) {
    return handleApiError(error);
  }
}
