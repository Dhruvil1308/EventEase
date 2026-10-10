import { API_URL } from "./config";
import { supabase } from "./supabase";

export type FieldErrors = Record<string, string[] | undefined>;

/** An error from the API, with its code and per-field messages for forms. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly fields?: FieldErrors,
  ) {
    super(message);
  }
}

async function token(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

/** Headers every request carries: the signed-in user's token, when there is one. */
export async function authHeaders(): Promise<Record<string, string>> {
  const t = await token();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

type RequestOptions = { method?: string; body?: unknown; form?: FormData; signal?: AbortSignal };

async function send(path: string, { method = "GET", body, form, signal }: RequestOptions): Promise<Response> {
  const headers: Record<string, string> = { Accept: "application/json", ...(await authHeaders()) };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  return fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: form ?? (body !== undefined ? JSON.stringify(body) : undefined),
    signal,
  });
}

/**
 * Calls the EventEase API and returns its JSON. A dropped connection or a
 * database blip (503) is retried once before giving up, so a flaky campus
 * network doesn't surface as an error. Some endpoints answer 409 with a body
 * that is a normal result (e.g. a duplicate check-in) — pass `okStatuses`.
 */
export async function api<T>(path: string, opts: RequestOptions & { okStatuses?: number[] } = {}): Promise<T> {
  let res: Response;
  try {
    res = await send(path, opts);
    if (res.status === 503 && !opts.form) {
      await new Promise((r) => setTimeout(r, 1200));
      res = await send(path, opts);
    }
  } catch (error) {
    if ((error as Error)?.name === "AbortError") throw error;
    throw new ApiError("Can't reach EventEase. Check your internet connection and try again.", 0, "NETWORK");
  }

  const data = await res.json().catch(() => null);
  if (res.ok || opts.okStatuses?.includes(res.status)) return data as T;
  const err = (data as { error?: { code?: string; message?: string; fields?: FieldErrors } } | null)?.error;
  throw new ApiError(
    err?.message ?? `Something went wrong (HTTP ${res.status}). Please try again.`,
    res.status,
    err?.code ?? "HTTP_ERROR",
    err?.fields,
  );
}

/** First error message for a form field, if the API flagged it. */
export const fieldError = (error: unknown, field: string) =>
  error instanceof ApiError ? error.fields?.[field]?.[0] : undefined;

export const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Something went wrong. Please try again.";

/** Uploads an image picked on the phone as multipart `file` (photos, event covers). */
export function uploadImage<T>(path: string, image: { uri: string; mimeType?: string | null }) {
  const form = new FormData();
  const type = image.mimeType ?? "image/jpeg";
  const ext = type.split("/")[1] ?? "jpg";
  // React Native's FormData takes a { uri, name, type } descriptor for files.
  form.append("file", { uri: image.uri, name: `upload.${ext}`, type } as unknown as Blob);
  return api<T>(path, { method: "PUT", form });
}
