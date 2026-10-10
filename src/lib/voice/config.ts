import "server-only";

import { AppError } from "@/lib/errors";

const env = (name: string) => process.env[name]?.trim() || null;

export const voiceEnv = () => ({
  sarvamKey: env("SARVAM_API_KEY"),
  openaiKey: env("OPENAI_API_KEY"),
  openaiModel: env("OPENAI_MODEL") ?? "gpt-4o-mini",
  vobizAuthId: env("VOBIZ_AUTH_ID"),
  vobizAuthToken: env("VOBIZ_AUTH_TOKEN"),
  vobizFrom: env("VOBIZ_FROM_NUMBER"),
});

let ngrokCache: { url: string | null; at: number } | null = null;

/**
 * The public HTTPS origin the phone provider can reach for webhooks.
 *
 *  1. PUBLIC_BASE_URL, when set (your ngrok or production domain).
 *  2. A running ngrok tunnel to this server, found through ngrok's local API —
 *     so in development `npm run dev:calls` (or `npm run tunnel`) is all it takes.
 *  3. The Vercel deployment URL.
 */
export async function resolvePublicBaseUrl(): Promise<string | null> {
  const explicit = env("PUBLIC_BASE_URL");
  if (explicit) return explicit.replace(/\/$/, "");

  if (!process.env.VERCEL) {
    if (ngrokCache && Date.now() - ngrokCache.at < 30_000) {
      if (ngrokCache.url) return ngrokCache.url;
    } else {
      let url: string | null = null;
      try {
        const res = await fetch(env("NGROK_API_URL") ?? "http://127.0.0.1:4040/api/tunnels", {
          signal: AbortSignal.timeout(800),
          cache: "no-store",
        });
        const data = (await res.json()) as { tunnels?: { public_url?: string; config?: { addr?: string } }[] };
        const https = (data.tunnels ?? []).filter((t) => t.public_url?.startsWith("https://"));
        // Another project's tunnel may share the ngrok agent: take the one to this server's port.
        const port = process.env.PORT ?? "3000";
        const ours = https.find((t) => t.config?.addr?.endsWith(`:${port}`)) ?? (https.length === 1 ? https[0] : null);
        url = ours?.public_url ?? null;
      } catch {
        // No tunnel running — fall through.
      }
      ngrokCache = { url, at: Date.now() };
      if (url) return url;
    }
  }

  const vercel = env("VERCEL_PROJECT_PRODUCTION_URL") ?? env("VERCEL_URL");
  return vercel ? `https://${vercel}` : null;
}

export type VoiceSetupItem = { key: string; label: string; ok: boolean; hint: string; required: boolean };

/** What's configured and what's missing — the call console shows this as a checklist. */
export async function voiceSetup(): Promise<{ canPreview: boolean; canCall: boolean; items: VoiceSetupItem[] }> {
  const e = voiceEnv();
  const publicUrl = await resolvePublicBaseUrl();
  const items: VoiceSetupItem[] = [
    {
      key: "SARVAM_API_KEY",
      label: "Sarvam AI (Bulbul v3 voice, Saaras v3 speech-to-text)",
      ok: Boolean(e.sarvamKey),
      hint: "Add SARVAM_API_KEY from dashboard.sarvam.ai",
      required: true,
    },
    {
      key: "VOBIZ",
      label: "Vobiz Indian number",
      ok: Boolean(e.vobizAuthId && e.vobizAuthToken && e.vobizFrom),
      hint: "Add VOBIZ_AUTH_ID, VOBIZ_AUTH_TOKEN and VOBIZ_FROM_NUMBER",
      required: true,
    },
    {
      key: "PUBLIC_BASE_URL",
      label: publicUrl ? `Public webhook URL · ${publicUrl}` : "Public webhook URL (ngrok)",
      ok: Boolean(publicUrl?.startsWith("https://")),
      hint: "Run `npm run dev:calls` (app + ngrok tunnel), or set PUBLIC_BASE_URL",
      required: true,
    },
    {
      key: "OPENAI_API_KEY",
      label: `OpenAI ${e.openaiModel} (natural scripts, reply understanding)`,
      ok: Boolean(e.openaiKey),
      hint: "Optional — without it Aanaya uses fixed scripts and keyword matching",
      required: false,
    },
  ];
  const canPreview = Boolean(e.sarvamKey);
  const canCall = items.filter((i) => i.required).every((i) => i.ok);
  return { canPreview, canCall, items };
}

export async function requireCallingReady(): Promise<string> {
  const setup = await voiceSetup();
  if (!setup.canCall) {
    const missing = setup.items.filter((i) => i.required && !i.ok).map((i) => i.hint);
    throw new AppError("VOICE_NOT_CONFIGURED", `Reminder calls aren't set up yet: ${missing.join("; ")}.`);
  }
  return (await resolvePublicBaseUrl())!;
}
