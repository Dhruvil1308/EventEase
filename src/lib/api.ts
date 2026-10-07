import { NextResponse } from "next/server";
import { isAppError } from "./errors";

export type ApiErrorBody = {
  error: { code: string; message: string; fields?: Record<string, string[] | undefined> };
};

export function apiError(status: number, code: string, message: string, fields?: ApiErrorBody["error"]["fields"]) {
  return NextResponse.json<ApiErrorBody>({ error: { code, message, fields } }, { status });
}

/** Maps expected AppErrors to their HTTP status and hides everything else behind a 500. */
export function handleApiError(error: unknown) {
  if (isAppError(error)) return apiError(error.status, error.code, error.message, error.fields);
  console.error("[api] unexpected error", error);
  return apiError(500, "INTERNAL_ERROR", "Something went wrong on our side. Please try again.");
}

export async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await request.json();
    return body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export const invalidJson = () => apiError(400, "INVALID_JSON", "Request body must be a JSON object.");
