/**
 * Preloaded with `node --import` (and `tsx --import` in development) so tracing and error
 * reporting start before BullMQ, ioredis or nodemailer are loaded.
 *
 * With `OTEL_EXPORTER_OTLP_ENDPOINT` set, `initObservability` first registers the ESM loader hooks
 * (`registerEsmHooks`) and then starts the SDK, so instrumentations also patch modules loaded with
 * `import`. That only works from a preloaded file: the entry point's own static imports are
 * already loaded by the time its code runs. Without the endpoint nothing is registered.
 * Metrics and OTel logs stay off unless `OTEL_METRICS_EXPORTER` / `OTEL_LOGS_EXPORTER` are set.
 */
import { initObservability, type Observability } from "@repo/observability";

import { env } from "./env";
import { SERVICE_NAME } from "./service";

export const observability: Observability = initObservability({
  serviceName: SERVICE_NAME,
  environment: env.NODE_ENV,
  sentryDsn: env.SENTRY_DSN,
  otlpEndpoint: env.OTEL_EXPORTER_OTLP_ENDPOINT,
});
