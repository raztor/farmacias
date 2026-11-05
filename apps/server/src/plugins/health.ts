import type { PrismaClient } from "@repo/db";
import type { QueueClient } from "@repo/queue";
import type { FastifyBaseLogger, FastifyPluginAsync } from "fastify";

import { withTimeout } from "../lib/with-timeout";

const DEFAULT_READINESS_TIMEOUT_MS = 2000;
const SERVICE_UNAVAILABLE = 503;

export type CheckStatus = "ok" | "error";

export type ReadinessReport = {
  status: CheckStatus;
  checks: { database: CheckStatus; redis: CheckStatus };
};

export type HealthPluginOptions = {
  db: Pick<PrismaClient, "$queryRaw">;
  queue: Pick<QueueClient, "ping">;
  timeoutMs?: number | undefined;
};

type Check = {
  name: keyof ReadinessReport["checks"];
  run: () => Promise<unknown>;
};

/** Runs one dependency check within the time budget; failures are logged, never thrown. */
const runCheck = async (
  check: Check,
  timeoutMs: number,
  log: FastifyBaseLogger,
): Promise<CheckStatus> => {
  try {
    const result = await withTimeout(check.run(), timeoutMs, `${check.name} check timed out`);
    if (result === false) throw new Error(`${check.name} check failed`);
    return "ok";
  } catch (error) {
    log.warn({ err: error, check: check.name }, "Readiness check failed");
    return "error";
  }
};

/** Health checks are probed constantly by orchestrators, so they skip the rate limiter. */
const UNLIMITED = { config: { rateLimit: false } } as const;

/**
 * `/health`: liveness (the process answers). `/ready`: readiness, PostgreSQL (`SELECT 1`) and
 * Redis (ping) must answer within the timeout, otherwise 503 so the load balancer stops routing.
 */
export const healthPlugin: FastifyPluginAsync<HealthPluginOptions> = (app, options) => {
  const timeoutMs = options.timeoutMs ?? DEFAULT_READINESS_TIMEOUT_MS;
  const checks: Check[] = [
    { name: "database", run: () => options.db.$queryRaw`SELECT 1` },
    { name: "redis", run: () => options.queue.ping() },
  ];

  app.get("/health", UNLIMITED, () => ({ status: "ok" as const }));

  app.get("/ready", UNLIMITED, async (request, reply) => {
    const [database = "error", redis = "error"] = await Promise.all(
      checks.map((check) => runCheck(check, timeoutMs, request.log)),
    );
    const healthy = database === "ok" && redis === "ok";
    const report: ReadinessReport = {
      status: healthy ? "ok" : "error",
      checks: { database, redis },
    };
    return reply
      .code(healthy ? 200 : SERVICE_UNAVAILABLE)
      .header("cache-control", "no-store")
      .send(report);
  });

  return Promise.resolve();
};
