/** Domain error codes. The API layer maps each one to the matching tRPC/HTTP error. */
export const APP_ERROR_CODES = [
  "BAD_REQUEST",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "INTERNAL",
] as const;

export type AppErrorCode = (typeof APP_ERROR_CODES)[number];

export type AppErrorOptions = {
  /** Underlying error, preserved for logs and error reporting. */
  cause?: unknown;
  /** Extra structured context (e.g. the conflicting field). Must be safe to expose to clients. */
  details?: unknown;
};

/** Domain error thrown by services and translated by the API layer. */
export class AppError extends Error {
  override readonly name = "AppError";
  readonly code: AppErrorCode;
  readonly details: unknown;

  constructor(code: AppErrorCode, message: string, options: AppErrorOptions = {}) {
    super(message, "cause" in options ? { cause: options.cause } : undefined);
    this.code = code;
    this.details = options.details;
  }
}

const isAppErrorCode = (value: unknown): value is AppErrorCode =>
  typeof value === "string" && (APP_ERROR_CODES as readonly string[]).includes(value);

/**
 * Type guard for `AppError`. Falls back to a structural check because bundlers can load
 * this package more than once (e.g. server vs. transpiled Next.js code), breaking `instanceof`.
 */
export const isAppError = (error: unknown): error is AppError => {
  if (error instanceof AppError) return true;
  return (
    error instanceof Error &&
    error.name === "AppError" &&
    isAppErrorCode((error as { code?: unknown }).code)
  );
};
