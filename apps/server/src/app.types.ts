import type { ApiDependencies } from "@repo/api";
import type { ExceptionContext, Logger } from "@repo/observability";

/** The slice of Better Auth that serves `/api/auth/*` (Web `Request` → Web `Response`). */
export type AuthRequestHandler = {
  handler: (request: Request) => Promise<Response>;
};

/** Reports unexpected errors (Sentry in production, a no-op when it is disabled). */
export type ErrorReporter = (error: unknown, context?: ExceptionContext) => void;

/**
 * Long-lived infrastructure the HTTP host needs. The real Better Auth instance satisfies `auth`
 * structurally, and tests pass small fakes.
 */
export type ServerDependencies = Omit<ApiDependencies, "auth" | "logger"> & {
  auth: ApiDependencies["auth"] & AuthRequestHandler;
  /** pino logger: Fastify uses it as its request logger. */
  logger: Logger;
  /** Defaults to `captureException` from `@repo/observability`. */
  reportError?: ErrorReporter;
};

export type AppConfig = {
  /** Browser origins allowed by CORS (credentials included). */
  trustedOrigins: readonly string[];
  /** Max requests per client IP and time window (default window: 1 minute). */
  rateLimitMax: number;
  rateLimitWindowMs?: number;
  /** Max accepted request body in bytes (default 1 MiB). */
  bodyLimit?: number;
  /**
   * Reverse proxies in front of the API: a hop count (`1` = one load balancer, `0` = none) or a
   * Fastify `trustProxy` value (CIDRs...). Default: 1 hop. Drives `request.ip`, which the rate
   * limiters use, so trusting more hops than exist lets clients spoof their IP.
   */
  trustProxy?: number | boolean | string;
  /** Time budget for each dependency check in `/ready` (default 2000 ms). */
  readinessTimeoutMs?: number;
};

export type BuildAppOptions = {
  deps: ServerDependencies;
  config: AppConfig;
};
