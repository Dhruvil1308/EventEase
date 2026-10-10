import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { AppError } from "@/lib/errors";
import { voiceEnv } from "./config";
import { CALL_LIMIT_SECONDS } from "./script";

/**
 * Vobiz — Indian numbers for outbound calls. Its REST API and XML are
 * Plivo-compatible. Docs: https://vobiz.ai/docs/call/make-call
 */
const API = "https://api.vobiz.ai/api/v1";

function credentials() {
  const { vobizAuthId, vobizAuthToken, vobizFrom } = voiceEnv();
  if (!vobizAuthId || !vobizAuthToken || !vobizFrom) {
    throw new AppError(
      "VOICE_NOT_CONFIGURED",
      "Add VOBIZ_AUTH_ID, VOBIZ_AUTH_TOKEN and VOBIZ_FROM_NUMBER to place calls.",
    );
  }
  return { authId: vobizAuthId, authToken: vobizAuthToken, from: vobizFrom.replace(/[^\d]/g, "") };
}

const authHeaders = () => {
  const { authId, authToken } = credentials();
  return { "X-Auth-ID": authId, "X-Auth-Token": authToken };
};

/**
 * Dials `to` (E.164). Vobiz then fetches `answerUrl` for what to play once the
 * person picks up. `time_limit` hard-stops the call 20 seconds after answer, so
 * a reminder can never run long even if something upstream misbehaves.
 */
export async function placeCall(opts: {
  to: string;
  answerUrl: string;
  hangupUrl: string;
  ringUrl: string;
}): Promise<{ providerCallId: string }> {
  const { authId, from } = credentials();
  const res = await fetch(`${API}/Account/${encodeURIComponent(authId)}/Call/`, {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: opts.to,
      answer_url: opts.answerUrl,
      answer_method: "POST",
      hangup_url: opts.hangupUrl,
      hangup_method: "POST",
      ring_url: opts.ringUrl,
      ring_method: "POST",
      time_limit: CALL_LIMIT_SECONDS,
      // Give up after 30 seconds of ringing rather than the 2-minute default.
      hangup_on_ring: 30,
      caller_name: "EventEase",
    }),
    signal: AbortSignal.timeout(15_000),
  });
  const text = await res.text();
  if (!res.ok) {
    console.error("[vobiz] call failed", res.status, text.slice(0, 400));
    const reason =
      res.status === 401 || res.status === 404
        ? "check VOBIZ_AUTH_ID / VOBIZ_AUTH_TOKEN"
        : res.status === 402
          ? "the Vobiz balance is too low"
          : res.status === 429
            ? "too many calls at once"
            : `HTTP ${res.status}`;
    throw new AppError("VOICE_PROVIDER_ERROR", `Vobiz couldn't place the call (${reason}).`);
  }
  let data: { request_uuid?: string; call_uuid?: string } = {};
  try {
    data = JSON.parse(text);
  } catch {
    // Handled below.
  }
  const providerCallId = data.request_uuid ?? data.call_uuid;
  if (!providerCallId) throw new AppError("VOICE_PROVIDER_ERROR", "Vobiz accepted the call but returned no call id.");
  return { providerCallId };
}

const escapeXml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export const xmlResponse = (body: string) =>
  new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<Response>${body}</Response>`, {
    headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "no-store" },
  });

/**
 * What the call does once answered: play Aanaya's message, then — if there's
 * room in the 20-second budget — record a few seconds of reply for Saaras to
 * transcribe, then hang up.
 */
export function reminderXml(opts: {
  audioUrl: string;
  replySeconds: number;
  recordActionUrl: string;
  recordCallbackUrl: string;
}): string {
  const record =
    opts.replySeconds > 0
      ? `<Record action="${escapeXml(opts.recordActionUrl)}" method="POST" redirect="false" ` +
        `callbackUrl="${escapeXml(opts.recordCallbackUrl)}" callbackMethod="POST" fileFormat="wav" ` +
        `maxLength="${opts.replySeconds}" timeout="2" playBeep="false" finishOnKey=""/>`
      : "";
  return `<Play>${escapeXml(opts.audioUrl)}</Play>${record}<Hangup/>`;
}

/**
 * Checks Vobiz's callback signature when one is present (V3, then V2):
 * base64(HMAC-SHA256(authToken, url [+ "."] + nonce)), over the public URL
 * without its query string. Returns null when the request carries no signature
 * (signing is opt-in per callback URL in the Vobiz console).
 */
export function verifyVobizSignature(headers: Headers, publicUrl: string): boolean | null {
  const { authToken } = credentials();
  const base = publicUrl.split("?")[0];
  const candidates: [string | null, string | null, string][] = [
    [headers.get("x-vobiz-signature-v3"), headers.get("x-vobiz-signature-v3-nonce"), "."],
    [headers.get("x-vobiz-signature-v2"), headers.get("x-vobiz-signature-v2-nonce"), ""],
  ];
  let sawSignature = false;
  for (const [signature, nonce, joiner] of candidates) {
    if (!signature || !nonce) continue;
    sawSignature = true;
    const expected = createHmac("sha256", authToken).update(`${base}${joiner}${nonce}`).digest("base64");
    // A header may carry several comma-separated signatures.
    for (const given of signature.split(",").map((s) => s.trim())) {
      const a = Buffer.from(expected);
      const b = Buffer.from(given);
      if (a.length === b.length && timingSafeEqual(a, b)) return true;
    }
  }
  return sawSignature ? false : null;
}

/** Recordings are private on Vobiz; fetch one with the account credentials. */
export async function downloadRecording(url: string): Promise<Uint8Array> {
  const host = new URL(url).hostname;
  // Only send credentials to Vobiz itself, never to an arbitrary URL from a request.
  const headers = /(^|\.)vobiz\.ai$/i.test(host) ? authHeaders() : undefined;
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new AppError("VOICE_PROVIDER_ERROR", `Couldn't download the recording (HTTP ${res.status}).`);
  return new Uint8Array(await res.arrayBuffer());
}
