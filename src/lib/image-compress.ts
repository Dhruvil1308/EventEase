"use client";

import { MAX_IMAGE_BYTES } from "@/lib/media";

/**
 * Shrinks a photo in the browser until it fits the 300 KB storage limit, so
 * people can pick a 6 MB phone photo and it just works. Tries WebP (falling
 * back to JPEG where the browser can't encode WebP), lowers quality first,
 * then dimensions.
 */
export async function compressImage(
  file: File,
  { maxBytes = MAX_IMAGE_BYTES - 8 * 1024, maxWidth = 1600, maxHeight = 1600 } = {},
): Promise<File> {
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) throw new Error("That file isn't an image this browser can read.");

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Image processing isn't available in this browser.");

  let scale = Math.min(1, maxWidth / bitmap.width, maxHeight / bitmap.height);
  const type = (await supportsWebp()) ? "image/webp" : "image/jpeg";
  const ext = type === "image/webp" ? "webp" : "jpg";
  const base = file.name.replace(/\.[^.]+$/, "") || "image";

  for (let round = 0; round < 8; round++) {
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.86, 0.76, 0.66, 0.56, 0.46]) {
      const blob = await toBlob(canvas, type, quality);
      if (blob && blob.size <= maxBytes) {
        bitmap.close();
        return new File([blob], `${base}.${ext}`, { type });
      }
    }
    scale *= 0.75;
  }
  bitmap.close();
  throw new Error("Couldn't shrink that image under 300 KB — try a smaller one.");
}

const toBlob = (canvas: HTMLCanvasElement, type: string, quality: number) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));

let webp: Promise<boolean> | null = null;
function supportsWebp() {
  webp ??= (async () => {
    const c = document.createElement("canvas");
    c.width = c.height = 1;
    const blob = await toBlob(c, "image/webp", 0.8);
    return blob?.type === "image/webp";
  })();
  return webp;
}
