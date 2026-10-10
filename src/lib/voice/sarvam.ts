import "server-only";

import { AppError } from "@/lib/errors";
import { CALL_LANGUAGES, type CallLanguage } from "@/lib/call-languages";
import { voiceEnv } from "./config";
import { sniffAudio, wavDurationMs } from "./wav";

const API = "https://api.sarvam.ai";

/**
 * Aanaya's voice: female Bulbul v3 speakers that suit each language. Override
 * with SARVAM_SPEAKER (one voice everywhere) or SARVAM_SPEAKER_HI/_GU/_EN.
 */
const DEFAULT_SPEAKER: Record<CallLanguage, string> = { hi: "priya", gu: "priya", en: "ishita" };

export function speakerFor(language: CallLanguage): string {
  const specific = process.env[`SARVAM_SPEAKER_${language.toUpperCase()}`]?.trim();
  return specific || process.env.SARVAM_SPEAKER?.trim() || DEFAULT_SPEAKER[language];
}

function key(): string {
  const k = voiceEnv().sarvamKey;
  if (!k) throw new AppError("VOICE_NOT_CONFIGURED", "Add SARVAM_API_KEY to enable Aanaya's voice.");
  return k;
}

async function sarvamError(res: Response, what: string): Promise<never> {
  const detail = await res.text().catch(() => "");
  console.error(`[sarvam] ${what} failed`, res.status, detail.slice(0, 400));
  throw new AppError("VOICE_PROVIDER_ERROR", `Sarvam couldn't ${what} (HTTP ${res.status}).`);
}

/**
 * Speaks `text` with Bulbul v3 as 8 kHz mono WAV — telephone quality, small,
 * and its header tells us exactly how long the call will play it for.
 */
export async function synthesize(
  text: string,
  language: CallLanguage,
  { pace = 1.1 }: { pace?: number } = {},
): Promise<{ audio: Uint8Array; durationMs: number }> {
  const res = await fetch(`${API}/text-to-speech`, {
    method: "POST",
    headers: { "api-subscription-key": key(), "Content-Type": "application/json" },
    body: JSON.stringify({
      text,
      language_code: CALL_LANGUAGES[language].sarvam,
      model: "bulbul:v3",
      speaker: speakerFor(language),
      pace,
      // Sarvam's telephony preset: steadier delivery, 8 kHz.
      temperature: 0.4,
      speech_sample_rate: 8000,
      output_audio_codec: "wav",
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) await sarvamError(res, "generate the voice");
  const data = (await res.json()) as { audios?: string[] };
  const b64 = data.audios?.[0];
  if (!b64) throw new AppError("VOICE_PROVIDER_ERROR", "Sarvam returned no audio.");
  const audio = new Uint8Array(Buffer.from(b64, "base64"));
  // Fall back to the 8 kHz 16-bit size estimate if the header is unusual.
  const durationMs = wavDurationMs(audio) ?? Math.round(((audio.length - 44) / 16_000) * 1000);
  return { audio, durationMs };
}

/** Transcribes a short reply with Saaras v3. `language` hints the expected language. */
export async function transcribe(audio: Uint8Array, language?: CallLanguage): Promise<{ transcript: string }> {
  const { mime, ext } = sniffAudio(audio);
  const form = new FormData();
  form.append("file", new Blob([audio as BlobPart], { type: mime }), `reply.${ext}`);
  form.append("model", "saaras:v3");
  form.append("mode", "transcribe");
  form.append("language_code", language ? CALL_LANGUAGES[language].sarvam : "unknown");

  const res = await fetch(`${API}/speech-to-text`, {
    method: "POST",
    headers: { "api-subscription-key": key() },
    body: form,
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) await sarvamError(res, "transcribe the reply");
  const data = (await res.json()) as { transcript?: string };
  return { transcript: (data.transcript ?? "").trim() };
}
