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
 * `getClaims()` verifies the access token's signature locally against the
 * project's published JWKS, so it is as trustworthy as `getUser()` but costs no
 * network round trip — and this runs on every request, including the navbar.
 * Wrapped in `cache` so the many server components on a page share one lookup.
 */
export const getCurrentProfile = cache(async (): Promise<SessionProfile | null> => {
  // Reading the session is request data (cookies, and the token is checked
  // against the clock), so this can never be part of a prerender.
  await connection();

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = error ? null : data?.claims;
  const userId = typeof claims?.sub === "string" ? claims.sub : null;
  if (!userId) return null;

  const profile = await prisma.profile.findUnique({ where: { id: userId } });
  if (profile) return profile;

  // No profile row for a valid token — only reachable if account creation was
  // interrupted. This is rare, so pay for the authoritative lookup here rather
  // than trusting claims to resurrect a profile for a deleted account.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

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

/** A host that owns this event, 404-style redirect otherwise. Sign-in returns to `destination`. */
export async function requireEventOwner(eventId: string, destination = `/events/${eventId}`): Promise<SessionProfile> {
  // The two lookups don't depend on each other, so they share one round trip.
  const [profile, event] = await Promise.all([
    getCurrentProfile(),
    prisma.event.findUnique({ where: { id: eventId }, select: { hostId: true } }),
  ]);

  if (!profile) redirect(`${SIGN_IN_FOR[Role.HOST]}${nextParam(destination)}`);
  if (profile.role !== Role.HOST) redirect(`${HOME_FOR[profile.role]}?denied=host`);
  if (!event) redirect("/host?missing=1");
  if (event.hostId !== profile.id) redirect("/host?denied=owner");
  return profile;
}
