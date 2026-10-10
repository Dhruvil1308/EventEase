"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Role } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { HOME_FOR, SIGN_IN_FOR } from "@/lib/auth";
import { createAccount } from "@/lib/services/accounts";
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

/** Creates the account (see `createAccount`) and signs it in immediately. */
export async function signUpAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const role = roleFrom(formData.get("role"));
  const parsed = signUpSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: "Please fix the highlighted fields.", fields: fieldErrors(parsed.error) };
  }
  const { email, password } = parsed.data;

  const created = await createAccount(parsed.data, role);
  if (!created.ok) return { error: created.error, fields: created.fields };

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
