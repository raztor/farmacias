/**
 * Preloaded with `node --import` (and `tsx --import` in development) so tracing and error
 * reporting start before Fastify, Prisma or ioredis are loaded. It only reads the variables it
 * needs: the full configuration is validated later by `env.ts`.
 *
 * With `OTEL_EXPORTER_OTLP_ENDPOINT` set, `initObservability` first registers the ESM loader hooks
 * (`registerEsmHooks`) and then starts the SDK, so instrumentations also patch modules loaded with
 * `import`. That only works from a preloaded file: the entry point's own static imports are
 * already loaded by the time its code runs. Without the endpoint nothing is registered.
 * Fastify spans come from the `@fastify/otel` plugin, which `buildApp` registers when tracing is on
 * (`getFastifyOtelPlugin`). Metrics and OTel logs stay off unless `OTEL_METRICS_EXPORTER` /
 * `OTEL_LOGS_EXPORTER` are set.
 */
import { initObservability, type Observability } from "@repo/observability";

import { parseObservabilityEnv } from "./env.schema";
import { SERVICE_NAME } from "./service";

const observabilityEnv = parseObservabilityEnv(process.env);

export const observability: Observability = initObservability({
  serviceName: SERVICE_NAME,
  environment: observabilityEnv.NODE_ENV,
  sentryDsn: observabilityEnv.SENTRY_DSN,
  otlpEndpoint: observabilityEnv.OTEL_EXPORTER_OTLP_ENDPOINT,
});
