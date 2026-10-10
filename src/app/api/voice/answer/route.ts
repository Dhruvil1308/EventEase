import { answerCall } from "@/lib/services/reminders";
import { readVoiceWebhook } from "@/lib/voice/webhook";
import { xmlResponse } from "@/lib/voice/vobiz";

/**
 * Vobiz answer_url — the attendee picked up. Replies with VobizXML: play
 * Aanaya's pre-generated reminder, record a short reply, hang up. Must answer
 * within a second or two, which is why the audio is prepared before dialling.
 */
async function handle(request: Request) {
  const hook = await readVoiceWebhook(request);
  if (!hook.ok) return new Response("Forbidden", { status: hook.status });
  try {
    return xmlResponse(await answerCall(hook.callId));
  } catch (error) {
    console.error("[voice] answer failed", error);
    return xmlResponse("<Hangup/>");
  }
}

export const POST = handle;
export const GET = handle;
