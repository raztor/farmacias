import { fastifyCors } from "@fastify/cors";
import { fastifyHelmet } from "@fastify/helmet";
import { fastifyRateLimit } from "@fastify/rate-limit";
import type { FastifyInstance } from "fastify";

import { toCorsOrigins } from "../lib/origins";
import { REQUEST_ID_HEADER } from "../lib/request-id";

const ONE_MINUTE_MS = 60_000;
const CORS_PREFLIGHT_MAX_AGE_SECONDS = 600;
const TOO_MANY_REQUESTS = 429;

export type SecurityOptions = {
  trustedOrigins: readonly string[];
  rateLimitMax: number;
  rateLimitWindowMs?: number | undefined;
};

type RateLimitError = Error & { statusCode: number; code: string };

const rateLimitError = (statusCode: number, after: string): RateLimitError =>
  Object.assign(new Error(`Demasiadas solicitudes. Intenta nuevamente en ${after}.`), {
    statusCode,
    code: statusCode === TOO_MANY_REQUESTS ? "TOO_MANY_REQUESTS" : "FORBIDDEN",
  });

/**
 * Registers helmet, CORS and rate limiting on the ROOT instance (the plugins themselves are
 * wrapped with `fastify-plugin`), so they apply to every route registered afterwards.
 */
export const registerSecurity = async (
  app: FastifyInstance,
  options: SecurityOptions,
): Promise<void> => {
  // JSON-only API: helmet's defaults (strict CSP, no sniffing, HSTS, frameguard...) fit as-is.
  await app.register(fastifyHelmet, { global: true });

  await app.register(fastifyCors, {
    // Requests without `Origin` (mobile app, server-to-server, curl) are not CORS requests.
    origin: toCorsOrigins(options.trustedOrigins),
    credentials: true,
    methods: ["GET", "POST", "OPTIONS"],
    exposedHeaders: [REQUEST_ID_HEADER],
    maxAge: CORS_PREFLIGHT_MAX_AGE_SECONDS,
  });

  // In-memory store: limits are per instance. `request.ip` honors `trustProxy`.
  await app.register(fastifyRateLimit, {
    global: true,
    max: options.rateLimitMax,
    timeWindow: options.rateLimitWindowMs ?? ONE_MINUTE_MS,
    errorResponseBuilder: (_request, context) => rateLimitError(context.statusCode, context.after),
  });
};
