import { NextResponse } from "next/server";
import { isAppError } from "./errors";
import { isTransientDbError } from "./prisma";

export type ApiErrorBody = {
  error: { code: string; message: string; fields?: Record<string, string[] | undefined> };
};

export function apiError(status: number, code: string, message: string, fields?: ApiErrorBody["error"]["fields"]) {
  return NextResponse.json<ApiErrorBody>({ error: { code, message, fields } }, { status });
}

/**
 * Maps expected AppErrors to their HTTP status. A dropped or overloaded
 * database connection becomes a 503 the client can retry; everything else is
 * hidden behind a 500.
 */
export function handleApiError(error: unknown) {
  if (isAppError(error)) return apiError(error.status, error.code, error.message, error.fields);
  if (isTransientDbError(error)) {
    console.warn("[api] database unavailable:", error instanceof Error ? error.message : error);
    const res = apiError(
      503,
      "DATABASE_UNAVAILABLE",
      "We couldn't reach our database just now. Please try again in a moment.",
    );
    res.headers.set("Retry-After", "5");
    return res;
  }
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
