import { createEnv, zCommaList, type EnvSource } from "@repo/shared";
import { z } from "zod";

const MAX_PORT = 65_535;
const DEFAULT_PORT = 4000;
const DEFAULT_RATE_LIMIT_MAX = 300;
const MAX_PROXY_HOPS = 10;
/** Same minimum as `AUTH_SECRET_MIN_LENGTH` in `@repo/auth`. */
const AUTH_SECRET_MIN_LENGTH = 32;

const LOG_LEVELS = ["fatal", "error", "warn", "info", "debug", "trace", "silent"] as const;

const urlWithProtocol = (protocol: RegExp, message: string) => z.url({ protocol, error: message });

const httpUrl = urlWithProtocol(/^https?$/, "Expected an http(s) URL");

/** Named ranges understood by Fastify's `trustProxy` (proxy-addr). */
const PROXY_RANGE_NAMES = ["loopback", "linklocal", "uniquelocal"] as const;

/** A trusted proxy: a named range, an IP address or a CIDR block. */
const trustedProxyAddress = z.union(
  [z.enum(PROXY_RANGE_NAMES), z.ipv4(), z.ipv6(), z.cidrv4(), z.cidrv6()],
  { error: `Expected an IP, a CIDR or one of ${PROXY_RANGE_NAMES.join(", ")}` },
);

/** Variables needed before anything else loads (`instrument.ts`). */
export const observabilityEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  SENTRY_DSN: z.url().optional(),
  OTEL_EXPORTER_OTLP_ENDPOINT: httpUrl.optional(),
});

export const serverEnvSchema = observabilityEnvSchema.extend({
  LOG_LEVEL: z.enum(LOG_LEVELS).default("info"),
  HOST: z.string().trim().min(1).default("0.0.0.0"),
  PORT: z.coerce.number().int().min(0).max(MAX_PORT).default(DEFAULT_PORT),
  DATABASE_URL: urlWithProtocol(/^postgres(ql)?$/, "Expected a postgres:// or postgresql:// URL"),
  REDIS_URL: urlWithProtocol(/^rediss?$/, "Expected a redis:// or rediss:// URL"),
  BETTER_AUTH_SECRET: z
    .string()
    .trim()
    .min(AUTH_SECRET_MIN_LENGTH, `Must be at least ${AUTH_SECRET_MIN_LENGTH} characters long`),
  BETTER_AUTH_URL: httpUrl,
  /** Comma-separated origins, e.g. `http://localhost:8081,http://localhost:3001,bnp://`. */
  TRUSTED_ORIGINS: zCommaList.pipe(z.array(z.string().min(1)).min(1, "At least one origin")),
  /** Reverse proxies (load balancers) in front of the API; 0 when it is exposed directly. */
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(MAX_PROXY_HOPS).default(1),
  /**
   * Comma-separated proxy addresses to trust instead of a hop count, e.g.
   * `loopback,uniquelocal`: the client IP is the right-most `X-Forwarded-For` entry that is not
   * one of them, whatever the number of proxies on each route (TLS proxy → admin or mobile-web →
   * server). Overrides `TRUST_PROXY_HOPS` when set.
   */
  TRUST_PROXY_ADDRESSES: zCommaList.pipe(z.array(trustedProxyAddress)).optional(),
  /** Requests per minute and client IP across the whole API. */
  RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(DEFAULT_RATE_LIMIT_MAX),
});

export type ObservabilityEnv = z.output<typeof observabilityEnvSchema>;
export type ServerEnv = z.output<typeof serverEnvSchema>;

/** Validates the server configuration; throws listing every invalid variable. */
export const parseServerEnv = (source: EnvSource): ServerEnv => createEnv(serverEnvSchema, source);

/** Validates only the variables `instrument.ts` needs. */
export const parseObservabilityEnv = (source: EnvSource): ObservabilityEnv =>
  createEnv(observabilityEnvSchema, source);
