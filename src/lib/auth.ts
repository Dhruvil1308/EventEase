import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import type { Profile } from "@/generated/prisma/client";
import { Role } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type SessionProfile = Profile;

/** Where each role lives once signed in. */
export const HOME_FOR: Record<Role, string> = {
  ATTENDEE: "/dashboard",
  HOST: "/host",
};

/** Where each role signs in. */
export const SIGN_IN_FOR: Record<Role, string> = {
  ATTENDEE: "/signin",
  HOST: "/host/signin",
};

/**
 * The signed-in user's profile, or null.
 *
 * `getUser()` revalidates the JWT against Supabase rather than trusting the
 * cookie, so this is safe to gate on. Wrapped in `cache` so the many server
 * components on a page share one lookup per request.
 */
export const getCurrentProfile = cache(async (): Promise<SessionProfile | null> => {
  // Reading the session is request data (cookies, and Supabase checks token
  // expiry against the clock), so this can never be part of a prerender.
  await connection();

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const profile = await prisma.profile.findUnique({ where: { id: user.id } });
  if (profile) return profile;

  // The auth user exists but its profile row doesn't — only reachable if account
  // creation was interrupted. Rebuild it from the signup metadata.
  const meta = (user.user_metadata ?? {}) as { name?: string; role?: string };
  const role = meta.role === Role.HOST ? Role.HOST : Role.ATTENDEE;
  return prisma.profile.create({
    data: {
      id: user.id,
      email: user.email ?? `${user.id}@unknown.local`,
      name: meta.name?.trim() || user.email?.split("@")[0] || "Member",
      role,
    },
  });
});

function nextParam(destination?: string) {
  return destination ? `?next=${encodeURIComponent(destination)}` : "";
}

/** Any signed-in account, or redirect to the sign-in page for `expected`. */
export async function requireProfile(expected: Role, destination?: string): Promise<SessionProfile> {
  const profile = await getCurrentProfile();
  if (!profile) redirect(`${SIGN_IN_FOR[expected]}${nextParam(destination)}`);
  return profile;
}

/**
 * A host account. Attendees who land here are sent to their own dashboard
 * rather than a dead end, so the two portals never trap each other.
 */
export async function requireHost(destination?: string): Promise<SessionProfile> {
  const profile = await requireProfile(Role.HOST, destination);
  if (profile.role !== Role.HOST) redirect(`${HOME_FOR[profile.role]}?denied=host`);
  return profile;
}

/** An attendee account. */
export async function requireAttendee(destination?: string): Promise<SessionProfile> {
  const profile = await requireProfile(Role.ATTENDEE, destination);
  if (profile.role !== Role.ATTENDEE) redirect(`${HOME_FOR[profile.role]}?denied=attendee`);
  return profile;
}

/** A host that owns this event, 404-style redirect otherwise. */
export async function requireEventOwner(eventId: string): Promise<SessionProfile> {
  const profile = await requireHost(`/events/${eventId}`);
  const event = await prisma.event.findUnique({ where: { id: eventId }, select: { hostId: true } });
  if (!event) redirect("/host?missing=1");
  if (event.hostId !== profile.id) redirect("/host?denied=owner");
  return profile;
}
