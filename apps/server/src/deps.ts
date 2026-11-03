import { createAuth, type Auth } from "@repo/auth";
import { createPrismaClient, type PrismaClient } from "@repo/db";
import type { Logger } from "@repo/observability";
import { createQueueClient, type QueueClient } from "@repo/queue";

import type { AppConfig } from "./app.types";
import type { ServerEnv } from "./env.schema";
import { createWelcomeEmailHook } from "./welcome-email";

export type Infrastructure = {
  db: PrismaClient;
  queue: QueueClient;
  auth: Auth;
};

/**
 * Creates the long-lived clients. None of them connects eagerly: PostgreSQL and Redis are
 * reached on first use, so the process starts (and `/ready` reports) even when they are down.
 */
export const createInfrastructure = (env: ServerEnv, logger: Logger): Infrastructure => {
  const db = createPrismaClient({
    databaseUrl: env.DATABASE_URL,
    logger: logger.child({ module: "db" }),
  });
  const queue = createQueueClient({ redisUrl: env.REDIS_URL, logger });
  const auth = createAuth({
    db,
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    trustedOrigins: env.TRUSTED_ORIGINS,
    isProduction: env.NODE_ENV === "production",
    onUserCreated: createWelcomeEmailHook(queue),
    logger,
  });
  return { db, queue, auth };
};

/** HTTP host settings derived from the validated environment. */
export const createAppConfig = (env: ServerEnv): AppConfig => ({
  trustedOrigins: env.TRUSTED_ORIGINS,
  rateLimitMax: env.RATE_LIMIT_MAX,
  trustProxy: env.TRUST_PROXY_HOPS,
});
