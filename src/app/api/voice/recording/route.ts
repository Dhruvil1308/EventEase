import { after } from "next/server";
import { processReply } from "@/lib/services/reminders";
import { readVoiceWebhook } from "@/lib/voice/webhook";
import { xmlResponse } from "@/lib/voice/vobiz";

/**
 * Two Vobiz <Record> callbacks share this route:
 *  - `stage=action` fires as recording starts; with redirect="false" it must
 *    return an empty <Response/> so the call carries on to <Hangup/>.
 *  - the callbackUrl fires when the file is ready: Saaras v3 transcribes it and
 *    the LLM works out whether the attendee is coming — after responding.
 */
export async function POST(request: Request) {
  const hook = await readVoiceWebhook(request);
  if (!hook.ok) return new Response("Forbidden", { status: hook.status });
  if (hook.params.stage === "action") return xmlResponse("");

  const recordUrl = hook.params.RecordUrl || hook.params.RecordFile || hook.params.RecordingUrl || "";
  const durationMs =
    Number(hook.params.RecordingDurationMs) || Number(hook.params.RecordingDuration) * 1000 || (recordUrl ? 1000 : 0);
  const safeUrl = /^https:\/\//i.test(recordUrl) ? recordUrl : "";
  after(() => processReply(hook.callId, { recordUrl: safeUrl, durationMs }));
  return new Response("OK");
}
