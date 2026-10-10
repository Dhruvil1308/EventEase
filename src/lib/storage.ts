import "server-only";

import { randomBytes } from "node:crypto";
import { AppError } from "@/lib/errors";
import { formatBytes, IMAGE_TYPES, MAX_IMAGE_BYTES, MEDIA_BUCKET, sniffImageType } from "@/lib/media";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/** Generated reminder audio. Separate bucket: different content types and size budget. */
export const VOICE_BUCKET = "voice-prompts";
const MAX_VOICE_BYTES = 2 * 1024 * 1024;

type ImageType = (typeof IMAGE_TYPES)[number];

const BUCKETS = {
  [MEDIA_BUCKET]: { public: true, fileSizeLimit: MAX_IMAGE_BYTES, allowedMimeTypes: [...IMAGE_TYPES] },
  // The telephony provider fetches this audio over plain HTTPS, so it must be public.
  [VOICE_BUCKET]: {
    public: true,
    fileSizeLimit: MAX_VOICE_BYTES,
    allowedMimeTypes: ["audio/wav", "audio/x-wav", "audio/mpeg"],
  },
} as const;

type BucketId = keyof typeof BUCKETS;

const ensured = new Map<BucketId, Promise<void>>();

/**
 * Creates the bucket on first use, or brings an existing one back in line with
 * the limits above. `npm run storage:setup` does the same ahead of time; this
 * makes a fresh project self-healing rather than failing its first upload.
 */
export function ensureBucket(id: BucketId): Promise<void> {
  let pending = ensured.get(id);
  if (!pending) {
    pending = (async () => {
      const storage = createSupabaseAdminClient().storage;
      const options = BUCKETS[id];
      const { data } = await storage.getBucket(id);
      const { error } = data
        ? await storage.updateBucket(id, { ...options, allowedMimeTypes: [...options.allowedMimeTypes] })
        : await storage.createBucket(id, { ...options, allowedMimeTypes: [...options.allowedMimeTypes] });
      if (error) throw new Error(`Couldn't prepare the "${id}" storage bucket: ${error.message}`);
    })();
    // A failure shouldn't be cached forever — let the next request retry.
    pending.catch(() => ensured.delete(id));
    ensured.set(id, pending);
  }
  return pending;
}

const EXT: Record<ImageType, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

const uniqueName = () => `${Date.now().toString(36)}-${randomBytes(5).toString("hex")}`;

/** Validates an uploaded image (≤ 300 KB, JPEG/PNG/WebP) and stores it under `folder`. Returns its path. */
export async function uploadImage(folder: string, file: File): Promise<string> {
  if (file.size === 0) throw new AppError("VALIDATION_ERROR", "That file is empty.", { file: ["That file is empty."] });
  if (file.size > MAX_IMAGE_BYTES) {
    const message = `Images must be ${formatBytes(MAX_IMAGE_BYTES)} or smaller (this one is ${formatBytes(file.size)}).`;
    throw new AppError("VALIDATION_ERROR", message, { file: [message] });
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = sniffImageType(bytes);
  if (!type) {
    const message = "Upload a JPEG, PNG or WebP image.";
    throw new AppError("VALIDATION_ERROR", message, { file: [message] });
  }

  await ensureBucket(MEDIA_BUCKET);
  const path = `${folder}/${uniqueName()}.${EXT[type]}`;
  const { error } = await createSupabaseAdminClient()
    .storage.from(MEDIA_BUCKET)
    .upload(path, bytes, { contentType: type, cacheControl: "31536000", upsert: false });
  if (error) {
    // The bucket's own limit is the last line of defence; surface it as a field error.
    const tooBig = /size|exceed|too large/i.test(error.message);
    const message = tooBig ? `Images must be ${formatBytes(MAX_IMAGE_BYTES)} or smaller.` : "Upload failed. Try again.";
    if (!tooBig) console.error("[storage] upload failed", error);
    throw new AppError("VALIDATION_ERROR", message, { file: [message] });
  }
  return path;
}

/** Best-effort delete — a leftover object is harmless, a failed request isn't worth an error page. */
export async function removeMedia(path: string | null | undefined) {
  if (!path) return;
  const { error } = await createSupabaseAdminClient().storage.from(MEDIA_BUCKET).remove([path]);
  if (error) console.warn("[storage] couldn't remove", path, error.message);
}

export async function uploadVoiceAudio(path: string, audio: Uint8Array, contentType: "audio/wav" | "audio/mpeg") {
  await ensureBucket(VOICE_BUCKET);
  const { error } = await createSupabaseAdminClient()
    .storage.from(VOICE_BUCKET)
    .upload(path, audio, { contentType, cacheControl: "31536000", upsert: true });
  if (error) throw new Error(`Couldn't store the reminder audio: ${error.message}`);
}

export function voiceAudioUrl(path: string): string {
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
  return `${base}/storage/v1/object/public/${VOICE_BUCKET}/${path}`;
}
