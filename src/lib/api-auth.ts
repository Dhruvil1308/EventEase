import "server-only";

import type { NextResponse } from "next/server";
import type { Profile } from "@/generated/prisma/client";
import { Role } from "@/generated/prisma/enums";
import { getCurrentProfile } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/api";

/**
 * Route-handler equivalents of the page guards in `auth.ts`.
 *
 * Pages redirect; an API must answer with a status code, so these return either
 * the profile or a ready-made JSON error. Call sites do:
 *   const gate = await requireApiRole(Role.HOST);
 *   if ("response" in gate) return gate.response;
 */
export type ApiGate = { profile: Profile } | { response: NextResponse };

export async function requireApiRole(role: Role): Promise<ApiGate> {
  const profile = await getCurrentProfile();
  if (!profile) {
    return { response: apiError(401, "UNAUTHORIZED", "Sign in to continue.") };
  }
  if (profile.role !== role) {
    const needed = role === Role.HOST ? "a host account" : "an attendee account";
    return { response: apiError(403, "FORBIDDEN", `This action needs ${needed}.`) };
  }
  return { profile };
}

/** A host that owns this specific event. */
export async function requireApiEventOwner(eventId: string): Promise<ApiGate> {
  // Independent lookups, so one round trip instead of two.
  const [gate, event] = await Promise.all([
    requireApiRole(Role.HOST),
    prisma.event.findUnique({ where: { id: eventId }, select: { hostId: true } }),
  ]);
  if ("response" in gate) return gate;

  if (!event) {
    return { response: apiError(404, "EVENT_NOT_FOUND", "This event doesn't exist.") };
  }
  if (event.hostId !== gate.profile.id) {
    return { response: apiError(403, "FORBIDDEN", "This event belongs to another host.") };
  }
  return gate;
}
