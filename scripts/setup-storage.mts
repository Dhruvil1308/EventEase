/**
 * Creates (or updates) the Supabase Storage buckets EventEase uses:
 *
 *   eventease-media  public · 300 KB max · JPEG / PNG / WebP   profile photos, event covers
 *   voice-prompts    public · 2 MB max   · WAV / MP3           Aanaya's generated reminder audio
 *
 *   npm run storage:setup
 *
 * Safe to re-run: existing buckets are brought back in line with these limits.
 * The app also does this lazily on its first upload.
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY in .env first.");

const storage = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } }).storage;

const BUCKETS = [
  {
    id: "eventease-media",
    options: { public: true, fileSizeLimit: 300 * 1024, allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"] },
  },
  {
    id: "voice-prompts",
    options: {
      public: true,
      fileSizeLimit: 2 * 1024 * 1024,
      allowedMimeTypes: ["audio/wav", "audio/x-wav", "audio/mpeg"],
    },
  },
];

for (const { id, options } of BUCKETS) {
  const { data } = await storage.getBucket(id);
  const { error } = data ? await storage.updateBucket(id, options) : await storage.createBucket(id, options);
  if (error) throw new Error(`${id}: ${error.message}`);
  const { data: check } = await storage.getBucket(id);
  console.log(
    `  ✓ ${id} ${data ? "updated" : "created"} — public: ${check?.public}, limit: ${check?.file_size_limit} bytes, types: ${check?.allowed_mime_types?.join(", ")}`,
  );
}
