import { captureException, getFastifyOtelPlugin } from "@repo/observability";
import { fastify, type FastifyBaseLogger } from "fastify";

import type { BuildAppOptions } from "./app.types";
import { REQUEST_ID_HEADER, resolveRequestId } from "./lib/request-id";
import { authPlugin } from "./plugins/auth";
import { registerErrorHandlers } from "./plugins/errors";
import { healthPlugin } from "./plugins/health";
import { registerSecurity } from "./plugins/security";
import { trpcPlugin } from "./plugins/trpc";

const ONE_MIB = 1024 * 1024;
const DEFAULT_PROXY_HOPS = 1;
/** tRPC batches put every procedure name in one path segment (`/trpc/a,b,c`). */
const MAX_PARAM_LENGTH = 5000;

/** Fastify accepts hop counts at runtime but only types them as a trust function. */
const toTrustProxy = (
  value: number | boolean | string,
): boolean | string | ((address: string, hop: number) => boolean) =>
  typeof value === "number" ? (_address, hop) => hop < value : value;

/**
 * Builds the HTTP host without listening, so tests drive it with `app.inject()`.
 * Every dependency is injected: nothing here opens connections by itself.
 */
export const buildApp = async ({ deps, config }: BuildAppOptions) => {
  const reportError = deps.reportError ?? captureException;
  // Widened on purpose: keeps the instance typed with Fastify's default logger, so plugins typed
  // as `FastifyInstance` / `FastifyPluginAsync` accept it.
  const loggerInstance: FastifyBaseLogger = deps.logger;

  const app = fastify({
    loggerInstance,
    genReqId: resolveRequestId,
    requestIdHeader: false,
    trustProxy: toTrustProxy(config.trustProxy ?? DEFAULT_PROXY_HOPS),
    bodyLimit: config.bodyLimit ?? ONE_MIB,
    routerOptions: { maxParamLength: MAX_PARAM_LENGTH },
    // Lets in-flight requests finish while `close()` rejects new ones with 503.
    return503OnClosing: true,
  });

  // OpenTelemetry Fastify spans (no-op unless tracing is on). It must come before every hook and
  // route: it only instruments the ones added after it.
  const otelPlugin = getFastifyOtelPlugin();
  if (otelPlugin !== undefined) {
    await app.register(otelPlugin);
  }

  app.addHook("onRequest", (request, reply, done) => {
    reply.header(REQUEST_ID_HEADER, request.id);
    done();
  });

  registerErrorHandlers(app, reportError);
  await registerSecurity(app, {
    trustedOrigins: config.trustedOrigins,
    rateLimitMax: config.rateLimitMax,
    rateLimitWindowMs: config.rateLimitWindowMs,
  });

  await app.register(healthPlugin, {
    db: deps.db,
    queue: deps.queue,
    timeoutMs: config.readinessTimeoutMs,
  });
  await app.register(authPlugin, { auth: deps.auth });
  await app.register(trpcPlugin, { deps, reportError });

  return app;
};

/** Fastify instance returned by {@link buildApp}. */
export type ServerApp = Awaited<ReturnType<typeof buildApp>>;
