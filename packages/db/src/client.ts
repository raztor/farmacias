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
    { connectionString },
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
