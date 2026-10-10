import { after } from "next/server";
import { dispatchNext, finishCall } from "@/lib/services/reminders";
import { readVoiceWebhook } from "@/lib/voice/webhook";

/**
 * Vobiz hangup_url — the call is over. Records how it went, then dials the
 * next person in the queue once the response is on its way (Vobiz wants an
 * answer within three seconds).
 */
export async function POST(request: Request) {
  const hook = await readVoiceWebhook(request);
  if (!hook.ok) return new Response("Forbidden", { status: hook.status });
  try {
    const eventId = await finishCall(hook.callId, {
      callStatus: hook.params.CallStatus ?? "",
      hangupCause: hook.params.HangupCause ?? hook.params.HangupCauseName ?? "",
      duration: hook.params.Duration ?? hook.params.BillDuration ?? "",
      answerTime: hook.params.AnswerTime ?? "",
    });
    if (eventId) after(() => dispatchNext(eventId));
  } catch (error) {
    console.error("[voice] hangup handling failed", error);
  }
  return new Response("OK");
}
