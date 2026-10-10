import "server-only";

import { resolvePublicBaseUrl } from "./config";
import { verify } from "./secret";
import { verifyVobizSignature } from "./vobiz";

/**
 * Reads and authenticates a Vobiz callback.
 *
 * Every callback URL we hand Vobiz carries our call id and an HMAC of it, so a
 * request without a valid one is rejected outright. If Vobiz also signed the
 * request (signing is opt-in per URL), that signature must check out too.
 */
export async function readVoiceWebhook(
  request: Request,
): Promise<{ ok: true; callId: string; params: Record<string, string> } | { ok: false; status: number }> {
  const url = new URL(request.url);
  const callId = url.searchParams.get("id") ?? "";
  if (!callId || !verify(callId, url.searchParams.get("t"))) return { ok: false, status: 403 };

  const base = await resolvePublicBaseUrl();
  if (base) {
    const signed = verifyVobizSignature(request.headers, `${base}${url.pathname}`);
    if (signed === false) return { ok: false, status: 403 };
  }

  const params: Record<string, string> = {};
  if (request.method === "POST") {
    const type = request.headers.get("content-type") ?? "";
    try {
      if (type.includes("application/json")) {
        for (const [k, v] of Object.entries((await request.json()) as Record<string, unknown>))
          params[k] = String(v ?? "");
      } else {
        for (const [k, v] of (await request.formData()).entries()) if (typeof v === "string") params[k] = v;
      }
    } catch {
      // An empty or odd body still identifies the call through the URL.
    }
  }
  for (const [k, v] of url.searchParams.entries()) if (!(k in params)) params[k] = v;
  return { ok: true, callId, params };
}
