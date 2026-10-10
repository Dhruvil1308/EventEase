import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { apiError, handleApiError } from "@/lib/api";
import { getCurrentProfile } from "@/lib/auth";
import { readImageUpload, setAvatar } from "@/lib/services/media";

/** PUT /api/profile/avatar — multipart `file`, an image of at most 300 KB. */
export async function PUT(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile) return apiError(401, "UNAUTHORIZED", "Sign in to continue.");
  try {
    const file = await readImageUpload(request);
    const result = await setAvatar(profile.id, file);
    revalidatePath("/", "layout");
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}

/** DELETE /api/profile/avatar — remove your photo. */
export async function DELETE() {
  const profile = await getCurrentProfile();
  if (!profile) return apiError(401, "UNAUTHORIZED", "Sign in to continue.");
  try {
    const result = await setAvatar(profile.id, null);
    revalidatePath("/", "layout");
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
