/**
 * Images (profile photos, event covers) live in one public Supabase Storage
 * bucket. Rows store the object path; this turns it into a URL anywhere —
 * server or browser — without a round trip.
 */
export const MEDIA_BUCKET = "eventease-media";

/** Hard cap for every image: 300 KB. The bucket itself enforces the same limit. */
export const MAX_IMAGE_BYTES = 300 * 1024;

export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export function mediaUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;
  return `${base.replace(/\/$/, "")}/storage/v1/object/public/${MEDIA_BUCKET}/${path}`;
}

export const formatBytes = (n: number) => (n < 1024 ? `${n} B` : `${Math.round(n / 1024)} KB`);

type ImageType = (typeof IMAGE_TYPES)[number];

/**
 * Identifies an image from its first bytes. The browser-supplied MIME type is
 * only a claim; this is what the file actually is.
 */
export function sniffImageType(bytes: Uint8Array): ImageType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.slice(from, to));
  if (bytes.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  return null;
}
