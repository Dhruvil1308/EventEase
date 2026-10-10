import type { FieldErrors } from "./validation";

export type AppErrorCode =
  | "VALIDATION_ERROR"
  | "EVENT_NOT_FOUND"
  | "EVENT_FULL"
  | "ALREADY_REGISTERED"
  | "CODE_GENERATION_FAILED"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "VOICE_NOT_CONFIGURED"
  | "VOICE_PROVIDER_ERROR"
  | "NOTHING_TO_CALL";

const STATUS: Record<AppErrorCode, number> = {
  VALIDATION_ERROR: 400,
  EVENT_NOT_FOUND: 404,
  EVENT_FULL: 409,
  ALREADY_REGISTERED: 409,
  CODE_GENERATION_FAILED: 500,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  VOICE_NOT_CONFIGURED: 503,
  VOICE_PROVIDER_ERROR: 502,
  NOTHING_TO_CALL: 409,
};

/** Expected, user-facing failures. Anything else is treated as a 500. */
export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly status: number;
  readonly fields?: FieldErrors;

  constructor(code: AppErrorCode, message: string, fields?: FieldErrors) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = STATUS[code];
    this.fields = fields;
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
