import { NextResponse } from "next/server";
import { Role } from "@/generated/prisma/enums";
import { apiError, handleApiError, invalidJson, readJson } from "@/lib/api";
import { createAccount } from "@/lib/services/accounts";
import { fieldErrors, signUpSchema } from "@/lib/validation";

/**
 * POST /api/auth/signup — create an attendee or host account (the Android app's
 * sign-up; the website uses a server action). Body: `{ role, name, email,
 * password, organization?, studentId?, department?, phone? }`. The app then
 * signs in with its own Supabase client.
 */
export async function POST(request: Request) {
  const body = await readJson(request);
  if (!body) return invalidJson();
  const parsed = signUpSchema.safeParse(body);
  if (!parsed.success)
    return apiError(400, "VALIDATION_ERROR", "Please fix the highlighted fields.", fieldErrors(parsed.error));

  try {
    const role = body.role === Role.HOST ? Role.HOST : Role.ATTENDEE;
    const created = await createAccount(parsed.data, role);
    if (!created.ok) return apiError(409, "ACCOUNT_EXISTS", created.error, created.fields);
    return NextResponse.json({ userId: created.userId, role }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
