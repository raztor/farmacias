import { toTRPCError, isServerError } from "./error-mapping";
import { createMiddleware } from "./init";

/**
 * Translates `AppError` into `TRPCError` and hides unexpected failures behind a generic
 * INTERNAL_SERVER_ERROR. tRPC never lets errors escape `next()`: they come back as a
 * failed result, so the mapping is applied to that result.
 */
export const errorMappingMiddleware = createMiddleware(async ({ next }) => {
  const result = await next();
  if (result.ok) return result;
  const error = toTRPCError(result.error);
  return error === result.error ? result : { ...result, error };
});

/** Logs every call with its duration. Server errors are logged with their original cause. */
export const loggingMiddleware = createMiddleware(async ({ ctx, next, path, type }) => {
  const startedAt = Date.now();
  const result = await next();
  const durationMs = Date.now() - startedAt;
  const bindings = { path, type, durationMs };

  if (result.ok) {
    ctx.logger.info(bindings, "tRPC call succeeded");
    return result;
  }
  const { error } = result;
  if (isServerError(error)) {
    ctx.logger.error(
      { ...bindings, code: error.code, err: error.cause ?? error },
      "tRPC call failed",
    );
  } else {
    ctx.logger.warn({ ...bindings, code: error.code }, "tRPC call rejected");
  }
  return result;
});
