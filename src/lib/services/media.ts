import "server-only";

import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { mediaUrl } from "@/lib/media";
import { removeMedia, uploadImage } from "@/lib/storage";

/** Replaces (or, with `null`, removes) an event's banner image. Owner only; the old image is deleted. */
export async function setEventCover(eventId: string, hostId: string, file: File | null) {
  const event = await prisma.event.findFirst({ where: { id: eventId, hostId }, select: { coverPath: true } });
  if (!event) throw new AppError("EVENT_NOT_FOUND", "This event no longer exists, or it isn't yours to edit.");
  const coverPath = file ? await uploadImage(`events/${eventId}`, file) : null;
  await prisma.event.update({ where: { id: eventId }, data: { coverPath } });
  await removeMedia(event.coverPath);
  return { coverUrl: mediaUrl(coverPath) };
}

/** Replaces (or removes) the signed-in user's profile photo. */
export async function setAvatar(userId: string, file: File | null) {
  const profile = await prisma.profile.findUnique({ where: { id: userId }, select: { avatarPath: true } });
  if (!profile) throw new AppError("UNAUTHORIZED", "Sign in to continue.");
  const avatarPath = file ? await uploadImage(`avatars/${userId}`, file) : null;
  await prisma.profile.update({ where: { id: userId }, data: { avatarPath } });
  await removeMedia(profile.avatarPath);
  return { avatarUrl: mediaUrl(avatarPath) };
}

/** Pulls the single `file` field out of a multipart upload, or explains what's wrong. */
export async function readImageUpload(request: Request): Promise<File> {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    throw new AppError("VALIDATION_ERROR", "Send the image as multipart form data.", {
      file: ["Choose an image to upload."],
    });
  }
  const file = form.get("file");
  if (!(file instanceof File)) {
    throw new AppError("VALIDATION_ERROR", "Choose an image to upload.", { file: ["Choose an image to upload."] });
  }
  return file;
}
