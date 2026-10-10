import { connection, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { apiError, handleApiError, invalidJson, readJson } from "@/lib/api";
import { getCurrentProfile } from "@/lib/auth";
import { toProfileView, updateProfile } from "@/lib/services/profiles";
import type { ProfileInput } from "@/lib/validation";

/** GET /api/profile — the signed-in user's profile. */
export async function GET() {
  await connection();
  const profile = await getCurrentProfile();
  if (!profile) return apiError(401, "UNAUTHORIZED", "Sign in to continue.");
  return NextResponse.json({ profile: toProfileView(profile) });
}

/** PUT /api/profile — update your own profile (mobile, bio, skills, hobbies, links…). */
export async function PUT(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile) return apiError(401, "UNAUTHORIZED", "Sign in to continue.");
  const body = await readJson(request);
  if (!body) return invalidJson();
  try {
    const updated = await updateProfile(profile.id, body as ProfileInput);
    // The navbar shows the name and photo on every page.
    revalidatePath("/", "layout");
    return NextResponse.json({ profile: updated });
  } catch (error) {
    return handleApiError(error);
  }
}
