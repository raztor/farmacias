import { TRPCError, type TRPC_ERROR_CODE_KEY } from "@trpc/server";
import { isAppError, type AppError, type AppErrorCode } from "@repo/shared";

/** Message returned to clients for unexpected failures. Details stay in the server logs. */
export const INTERNAL_ERROR_MESSAGE = "Ocurrió un error inesperado. Inténtalo nuevamente.";

const APP_ERROR_TO_TRPC = {
  BAD_REQUEST: "BAD_REQUEST",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  INTERNAL: "INTERNAL_SERVER_ERROR",
} as const satisfies Record<AppErrorCode, TRPC_ERROR_CODE_KEY>;

const fromAppError = (error: AppError): TRPCError => {
  const code = APP_ERROR_TO_TRPC[error.code];
  const message = code === "INTERNAL_SERVER_ERROR" ? INTERNAL_ERROR_MESSAGE : error.message;
  return new TRPCError({ code, message, cause: error });
};

/**
 * Normalizes an error produced by a procedure:
 * - `AppError` (thrown directly or wrapped by tRPC) becomes the matching `TRPCError`.
 * - Unexpected errors become INTERNAL_SERVER_ERROR with a generic message; the original
 *   error is kept as `cause` for logging and never sent to the client.
 * - Any other `TRPCError` (validation, auth guards...) is returned untouched.
 */
export const toTRPCError = (error: unknown): TRPCError => {
  if (isAppError(error)) return fromAppError(error);
  if (!(error instanceof TRPCError)) {
    return new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: INTERNAL_ERROR_MESSAGE,
      cause: error,
    });
  }
  if (isAppError(error.cause)) return fromAppError(error.cause);
  if (error.code === "INTERNAL_SERVER_ERROR" && error.message !== INTERNAL_ERROR_MESSAGE) {
    return new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: INTERNAL_ERROR_MESSAGE,
      cause: error.cause ?? error,
    });
  }
  return error;
};

/** `true` for errors caused by the server (5xx) rather than by the client request. */
export const isServerError = (error: TRPCError): boolean => error.code === "INTERNAL_SERVER_ERROR";
