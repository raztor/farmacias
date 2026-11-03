import { PrismaPg } from "@prisma/adapter-pg";

import { assertPostgresUrl } from "./database-url";
import { PrismaClient } from "./generated/prisma/client";
import { attachLogger, type DbLogger, type DbLogLevel, toLogDefinitions } from "./logging";

export type CreatePrismaClientOptions = {
  /** PostgreSQL connection string (`postgres://` or `postgresql://`). */
  databaseUrl: string;
  /** Prisma log levels to enable. Defaults to `["warn", "error"]`. */
  log?: readonly DbLogLevel[];
  /** Structured logger; when given, Prisma logs and pool errors are routed to it. */
  logger?: DbLogger;
};

const DEFAULT_LOG_LEVELS: readonly DbLogLevel[] = ["warn", "error"];

/**
 * Every session runs in UTC. `@prisma/adapter-pg` writes `Date` parameters as offset-less UTC
 * strings and reads `timestamptz` values by replacing their offset with `+00:00`, so in any other
 * session time zone (e.g. a Homebrew PostgreSQL in `America/Santiago`) Prisma-written instants
 * and `now()`/`DEFAULT CURRENT_TIMESTAMP` values would disagree by the UTC offset.
 */
const POSTGRES_SESSION_OPTIONS = "-c timezone=UTC";

/**
 * Creates a Prisma Client backed by the `pg` driver adapter.
 *
 * No connection is opened until the first query (or an explicit `$connect()`).
 * Callers own the lifecycle and must call `$disconnect()` on shutdown.
 */
export function createPrismaClient(options: CreatePrismaClientOptions): PrismaClient {
  const connectionString = assertPostgresUrl(options.databaseUrl);
  const { logger } = options;
  const levels = options.log ?? DEFAULT_LOG_LEVELS;

  const adapter = new PrismaPg(
    { connectionString, options: POSTGRES_SESSION_OPTIONS },
    logger
      ? {
          onPoolError: (error) => {
            logger.error({ err: error }, "postgres pool error");
          },
          onConnectionError: (error) => {
            logger.error({ err: error }, "postgres connection error");
          },
        }
      : undefined,
  );

  const client = new PrismaClient({ adapter, log: toLogDefinitions(levels, logger) });
  if (logger) {
    attachLogger(client, levels, logger);
  }
  return client;
}
