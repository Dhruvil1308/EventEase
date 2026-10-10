import "server-only";

import { Role } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { SignUpInput } from "@/lib/validation";

export type CreateAccountResult =
  { ok: true; userId: string } | { ok: false; error: string; fields?: Record<string, string[] | undefined> };

/**
 * Creates an account — Supabase auth user plus its profile — for the website's
 * sign-up form and the Android app alike.
 *
 * The user is created through the admin API with `email_confirm: true` so there
 * is no confirmation email to wait on: the account works the moment it exists.
 * Signing in is left to the caller (a cookie session on the web, the app's own
 * Supabase client on Android).
 */
export async function createAccount(input: SignUpInput, role: Role): Promise<CreateAccountResult> {
  const { name, email, password, organization, studentId, department, phone } = input;

  const existing = await prisma.profile.findUnique({ where: { email }, select: { role: true } });
  if (existing) {
    const where = existing.role === Role.HOST ? "the host portal" : "the attendee portal";
    return {
      ok: false,
      error:
        existing.role === role
          ? "An account with this email already exists. Sign in instead."
          : `This email is already registered as ${existing.role === Role.HOST ? "a host" : "an attendee"}. Sign in at ${where}.`,
      fields: { email: ["This email is already in use."] },
    };
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name, role },
  });
  if (error || !data.user) {
    return { ok: false, error: error?.message ?? "Couldn't create your account. Please try again." };
  }

  try {
    await prisma.profile.create({
      data: {
        id: data.user.id,
        email,
        name,
        role,
        organization: role === Role.HOST ? organization : undefined,
        studentId: role === Role.ATTENDEE ? studentId : undefined,
        department: role === Role.ATTENDEE ? department : undefined,
        phone,
      },
    });
  } catch (profileError) {
    // Don't strand an auth user with no profile — roll the account back.
    await admin.auth.admin.deleteUser(data.user.id).catch(() => {});
    console.error("[auth] profile creation failed", profileError);
    return { ok: false, error: "Couldn't finish setting up your account. Please try again." };
  }
  return { ok: true, userId: data.user.id };
}
