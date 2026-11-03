import { createEnv, type EnvSource } from "@repo/shared";
import { z } from "zod";

const MAX_PORT = 65_535;
const MAX_CONCURRENCY = 100;
const DEFAULT_CONCURRENCY = 5;
const DEFAULT_HEALTH_PORT = 4100;

const LOG_LEVELS = ["fatal", "error", "warn", "info", "debug", "trace", "silent"] as const;

const urlWithProtocol = (protocol: RegExp, message: string) => z.url({ protocol, error: message });

export const workerEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z.enum(LOG_LEVELS).default("info"),
  REDIS_URL: urlWithProtocol(/^rediss?$/, "Expected a redis:// or rediss:// URL"),
  /** Reserved for jobs that need the database; validated so deploys fail fast when missing. */
  DATABASE_URL: urlWithProtocol(/^postgres(ql)?$/, "Expected a postgres:// or postgresql:// URL"),
  SMTP_URL: urlWithProtocol(/^smtps?$/, "Expected an smtp:// or smtps:// URL"),
  /** RFC 5322 sender, e.g. `App <no-reply@app.local>`. */
  EMAIL_FROM: z.string().trim().min(3),
  WORKER_CONCURRENCY: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_CONCURRENCY)
    .default(DEFAULT_CONCURRENCY),
  WORKER_HEALTH_PORT: z.coerce.number().int().min(0).max(MAX_PORT).default(DEFAULT_HEALTH_PORT),
  SENTRY_DSN: z.url().optional(),
  OTEL_EXPORTER_OTLP_ENDPOINT: urlWithProtocol(/^https?$/, "Expected an http(s) URL").optional(),
});

export type WorkerEnv = z.output<typeof workerEnvSchema>;

/** Validates the worker configuration; throws listing every invalid variable. */
export const parseWorkerEnv = (source: EnvSource): WorkerEnv => createEnv(workerEnvSchema, source);
