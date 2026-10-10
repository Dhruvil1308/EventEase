import "server-only";

import { voiceEnv } from "./config";

/**
 * One structured-output call to the chat model (gpt-4o-mini by default).
 * Returns null on any failure — every caller has a deterministic fallback, so
 * a slow or missing LLM never blocks a reminder call.
 */
export async function chatJson<T>(opts: {
  system: string;
  user: string;
  schemaName: string;
  schema: Record<string, unknown>;
  timeoutMs?: number;
}): Promise<T | null> {
  const { openaiKey, openaiModel } = voiceEnv();
  if (!openaiKey) return null;
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: openaiModel,
        temperature: 0.3,
        messages: [
          { role: "system", content: opts.system },
          { role: "user", content: opts.user },
        ],
        response_format: {
          type: "json_schema",
          json_schema: { name: opts.schemaName, strict: true, schema: opts.schema },
        },
      }),
      signal: AbortSignal.timeout(opts.timeoutMs ?? 10_000),
    });
    if (!res.ok) {
      console.warn("[openai] request failed", res.status, (await res.text().catch(() => "")).slice(0, 300));
      return null;
    }
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = data.choices?.[0]?.message?.content;
    return content ? (JSON.parse(content) as T) : null;
  } catch (error) {
    console.warn("[openai] request failed", error instanceof Error ? error.message : error);
    return null;
  }
}
