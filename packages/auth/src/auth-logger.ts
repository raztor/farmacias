import type { AppLogger } from "@repo/shared";

type BetterAuthLogLevel = "debug" | "info" | "warn" | "error";

/** Shape of Better Auth's `logger` option (see `@better-auth/core` `Logger`). */
export type BetterAuthLoggerOption = {
  level: BetterAuthLogLevel;
  log: (level: BetterAuthLogLevel, message: string, ...args: unknown[]) => void;
};

/** Puts the first `Error` under `err` (pino's error serializer key) and keeps the rest as `args`. */
function toLogContext(args: readonly unknown[]): Record<string, unknown> {
  const err = args.find((arg) => arg instanceof Error);
  const rest = args.filter((arg) => arg !== err);
  return {
    ...(err === undefined ? {} : { err }),
    ...(rest.length > 0 ? { args: rest } : {}),
  };
}

/**
 * Routes Better Auth's internal logs to the structured application logger,
 * so they get the same format, redaction and transport as the rest of the service.
 */
export function toBetterAuthLogger(
  logger: AppLogger,
  isProduction: boolean,
): BetterAuthLoggerOption {
  const authLogger = logger.child({ module: "auth" });
  return {
    level: isProduction ? "warn" : "info",
    log: (level, message, ...args) => {
      authLogger[level](toLogContext(args), message);
    },
  };
}
