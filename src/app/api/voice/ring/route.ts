import { markRinging } from "@/lib/services/reminders";
import { readVoiceWebhook } from "@/lib/voice/webhook";

/** Vobiz ring_url — the attendee's phone is ringing. */
export async function POST(request: Request) {
  const hook = await readVoiceWebhook(request);
  if (!hook.ok) return new Response("Forbidden", { status: hook.status });
  await markRinging(hook.callId).catch((error) => console.error("[voice] ring update failed", error));
  return new Response("OK");
}
