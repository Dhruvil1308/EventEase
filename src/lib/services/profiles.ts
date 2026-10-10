import type { Profile } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { mediaUrl } from "@/lib/media";
import type { ProfileView } from "@/lib/profile-view";
import { fieldErrors, profileSchema, type ProfileInput } from "@/lib/validation";

export type { ProfileView } from "@/lib/profile-view";

export function toProfileView(p: Profile): ProfileView {
  return {
    id: p.id,
    email: p.email,
    name: p.name,
    role: p.role,
    phone: p.phone,
    bio: p.bio,
    skills: p.skills ?? [],
    hobbies: p.hobbies ?? [],
    college: p.college,
    city: p.city,
    organization: p.organization,
    studentId: p.studentId,
    department: p.department,
    linkedinUrl: p.linkedinUrl,
    githubUrl: p.githubUrl,
    callLanguage: p.callLanguage,
    avatarUrl: mediaUrl(p.avatarPath),
    createdAt: p.createdAt.toISOString(),
  };
}

export async function updateProfile(userId: string, input: ProfileInput): Promise<ProfileView> {
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError("VALIDATION_ERROR", "Please fix the highlighted fields.", fieldErrors(parsed.error));
  }
  const existing = await prisma.profile.findUnique({ where: { id: userId }, select: { role: true } });
  if (!existing) throw new AppError("UNAUTHORIZED", "Sign in to continue.");

  const { organization, studentId, department, ...shared } = parsed.data;
  const updated = await prisma.profile.update({
    where: { id: userId },
    // Role-specific fields only apply to their role; the rest is shared.
    data: existing.role === "HOST" ? { ...shared, organization } : { ...shared, studentId, department },
  });
  return toProfileView(updated);
}
