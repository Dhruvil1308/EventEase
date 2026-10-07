"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Role } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { HOME_FOR, SIGN_IN_FOR } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fieldErrors, signInSchema, signUpSchema } from "@/lib/validation";

export type AuthFormState = {
  error?: string;
  fields?: Record<string, string[] | undefined>;
} | null;

function roleFrom(value: FormDataEntryValue | null): Role {
  return value === Role.HOST ? Role.HOST : Role.ATTENDEE;
}

/** Only follow same-origin paths, so `?next=` can't be used as an open redirect. */
function safeNext(raw: FormDataEntryValue | null, fallback: string): string {
  const value = typeof raw === "string" ? raw : "";
  return value.startsWith("/") && !value.startsWith("//") ? value : fallback;
}

/**
 * Creates the account and signs it in immediately.
 *
 * The user is created through the admin API with `email_confirm: true` so there
 * is no confirmation email to wait on — the account works the moment it exists.
 */
export async function signUpAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const role = roleFrom(formData.get("role"));
  const parsed = signUpSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: "Please fix the highlighted fields.", fields: fieldErrors(parsed.error) };
  }
  const { name, email, password, organization, studentId, department, phone } = parsed.data;

  const existing = await prisma.profile.findUnique({ where: { email }, select: { role: true } });
  if (existing) {
    const where = existing.role === Role.HOST ? "the host portal" : "the attendee portal";
    return {
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
    return { error: error?.message ?? "Couldn't create your account. Please try again." };
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
        phone: role === Role.ATTENDEE ? phone : undefined,
      },
    });
  } catch (profileError) {
    // Don't strand an auth user with no profile — roll the account back.
    await admin.auth.admin.deleteUser(data.user.id).catch(() => {});
    console.error("[auth] profile creation failed", profileError);
    return { error: "Couldn't finish setting up your account. Please try again." };
  }

  const supabase = await createSupabaseServerClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
  if (signInError) {
    return { error: "Account created — please sign in." };
  }

  revalidatePath("/", "layout");
  redirect(safeNext(formData.get("next"), HOME_FOR[role]));
}

/**
 * Signs in, then enforces the portal split: a host account can't enter through
 * the attendee door and vice versa.
 */
export async function signInAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const role = roleFrom(formData.get("role"));
  const parsed = signInSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: "Please fix the highlighted fields.", fields: fieldErrors(parsed.error) };
  }
  const { email, password } = parsed.data;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    return { error: "That email and password don't match an account." };
  }

  const profile = await prisma.profile.findUnique({ where: { id: data.user.id } });
  if (!profile) {
    await supabase.auth.signOut();
    return { error: "This account isn't set up yet. Please sign up again." };
  }

  if (profile.role !== role) {
    await supabase.auth.signOut();
    const correct = SIGN_IN_FOR[profile.role];
    return {
      error:
        profile.role === Role.HOST
          ? `This is a host account. Sign in at the host portal (${correct}).`
          : `This is an attendee account. Sign in at the attendee portal (${correct}).`,
    };
  }

  revalidatePath("/", "layout");
  redirect(safeNext(formData.get("next"), HOME_FOR[profile.role]));
}

export async function signOutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}
