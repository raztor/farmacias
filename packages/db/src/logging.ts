import type { Prisma } from "./generated/prisma/client";

/** Log levels Prisma Client can emit. */
export type DbLogLevel = Prisma.LogLevel;

/**
 * Minimal structured logger accepted by the database client.
 * Structurally compatible with pino and with `AppLogger` from `@repo/shared`.
 */
export type DbLogger = {
  debug: (obj: object, msg?: string) => void;
  info: (obj: object, msg?: string) => void;
  warn: (obj: object, msg?: string) => void;
  error: (obj: object, msg?: string) => void;
};

type LoggableClient = {
  $on: (
    level: DbLogLevel,
    callback: (event: Prisma.QueryEvent | Prisma.LogEvent) => void,
  ) => unknown;
};

function isQueryEvent(event: Prisma.QueryEvent | Prisma.LogEvent): event is Prisma.QueryEvent {
  return "query" in event;
}

function forwardEvent(
  logger: DbLogger,
  level: DbLogLevel,
  event: Prisma.QueryEvent | Prisma.LogEvent,
): void {
  if (isQueryEvent(event)) {
    // Query parameters are never logged: they may contain credentials or personal data.
    logger.debug(
      { query: event.query, durationMs: event.duration, target: event.target },
      "prisma query",
    );
    return;
  }
  const payload = { target: event.target, prismaMessage: event.message };
  switch (level) {
    case "error":
      logger.error(payload, "prisma error");
      return;
    case "warn":
      logger.warn(payload, "prisma warning");
      return;
    case "info":
    case "query":
      logger.info(payload, "prisma info");
      return;
  }
}

/** Builds Prisma log definitions: events when a logger is given, stdout otherwise. */
export function toLogDefinitions(
  levels: readonly DbLogLevel[],
  logger: DbLogger | undefined,
): Prisma.LogDefinition[] {
  const emit = logger ? "event" : "stdout";
  return [...new Set(levels)].map((level) => ({ level, emit }));
}

/** Subscribes `logger` to every requested Prisma log level. */
export function attachLogger(
  client: LoggableClient,
  levels: readonly DbLogLevel[],
  logger: DbLogger,
): void {
  for (const level of new Set(levels)) {
    client.$on(level, (event) => {
      forwardEvent(logger, level, event);
    });
  }
}
