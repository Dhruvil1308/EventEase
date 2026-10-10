import "server-only";

import { CALL_LANGUAGES, type CallLanguage } from "@/lib/call-languages";
import { chatJson } from "./openai";
import {
  buildReminderScript,
  classifyReplyByKeywords,
  matchesScript,
  spokenStartTime,
  speakableName,
  type ReplyIntent,
  type ScriptInput,
} from "./script";

const SCRIPT_RULES: Record<CallLanguage, string> = {
  hi: "Hindi written in Devanagari, the way people in Gujarat and North India speak on the phone (light Hinglish is fine). Aanaya is female, so use feminine verb forms (बात कर रही हूँ).",
  gu: "Gujarati written in Gujarati script, warm and conversational. Aanaya is female.",
  en: "Simple, warm Indian English.",
};

/**
 * Aanaya's spoken reminder. The fixed template keeps the host's own wording;
 * gpt-4o-mini (when configured) makes it sound natural in the target language
 * and writes English event names in that language's script so the voice
 * pronounces them properly. Anything off-spec falls back to the template.
 */
export async function writeReminderScript(input: ScriptInput): Promise<{ script: string; polished: boolean }> {
  const draft = buildReminderScript(input);
  const result = await chatJson<{ script: string }>({
    schemaName: "reminder_script",
    schema: {
      type: "object",
      properties: { script: { type: "string" } },
      required: ["script"],
      additionalProperties: false,
    },
    system: [
      "You write the exact words Aanaya speaks on a short outbound reminder phone call for EventEase, a college event app.",
      `Language: ${CALL_LANGUAGES[input.language].label}. ${SCRIPT_RULES[input.language]}`,
      "Keep the meaning and order of the draft: Aanaya introduces herself, names the event and its start time, asks the person to arrive the given number of minutes early, and says thank you.",
      "Keep every fact exactly (event, day, time, minutes). You may transliterate English event names into the target script for pronunciation; keep acronyms recognisable.",
      "At most 32 words. No emojis, no markdown, no quotes, no stage directions. Output only what is spoken.",
    ].join("\n"),
    user: JSON.stringify({
      draft,
      event: speakableName(input.eventName),
      startTime: spokenStartTime(input.startsAt, input.language, input.now),
      arriveMinutesEarly: input.arriveEarly,
    }),
  });

  const script = result?.script?.replace(/\s+/g, " ").trim();
  if (
    script &&
    script.length >= 20 &&
    script.length <= 320 &&
    matchesScript(script, input.language) &&
    /aanaya|आनाया|આનાયા/i.test(script)
  ) {
    return { script, polished: true };
  }
  return { script: draft, polished: false };
}

/** Reads the attendee's spoken reply: are they coming? */
export async function understandReply(transcript: string, language: CallLanguage): Promise<ReplyIntent> {
  const text = transcript.trim();
  if (!text) return "NO_RESPONSE";
  const result = await chatJson<{ intent: ReplyIntent }>({
    schemaName: "reply_intent",
    schema: {
      type: "object",
      properties: { intent: { type: "string", enum: ["CONFIRMED", "DECLINED", "UNSURE", "NO_RESPONSE"] } },
      required: ["intent"],
      additionalProperties: false,
    },
    system: [
      "An attendee just heard a reminder call for a college event and replied. Classify the reply.",
      "CONFIRMED: they will come, or acknowledge positively (yes, ok, thank you, haan, aaunga, હા, આવીશ).",
      "DECLINED: they will not come or cannot make it.",
      "UNSURE: maybe, a question, or unclear.",
      "NO_RESPONSE: silence, noise, or nothing meaningful.",
      `The reply is most likely in ${CALL_LANGUAGES[language].label}, Hindi, Gujarati or English.`,
    ].join("\n"),
    user: text,
    timeoutMs: 8000,
  });
  return result?.intent ?? classifyReplyByKeywords(text);
}
